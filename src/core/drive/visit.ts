import { FetchMethod, FetchRequest } from "../../http/fetch_request"
import { FetchResponse } from "../../http/fetch_response"
import { getAnchor } from "../url"
import { PageSnapshot } from "./page_snapshot"
import { getHistoryMethodForAction, uuid } from "../../util"
import { StreamMessage } from "../streams/stream_message"
import { ViewTransitioner } from "./view_transitioner"

export interface VisitDelegate {
  adapter: VisitAdapter
  view: VisitView
  history: VisitHistory
  locationWithActionIsSamePage(location: URL, action: string): boolean
  visitStarted(visit: Visit): void
  visitCompleted(visit: Visit): void
  visitScrolledToSamePageLocation(oldURL: URL, newURL: URL): void
}

export interface VisitAdapter {
  visitStarted(visit: Visit): void
  visitCompleted(visit: Visit): void
  visitFailed(visit: Visit): void
  visitRequestStarted(visit: Visit): void
  visitRequestCompleted(visit: Visit): void
  visitRequestFailedWithStatusCode(visit: Visit, statusCode: number): void
  visitRequestFinished(visit: Visit): void
  visitRendered(visit: Visit): void
  visitProposedToLocation(location: URL, options?: VisitOptions): void
}

export interface VisitHistory {
  getRestorationDataForIdentifier(identifier: string): RestorationData
  update(method: typeof history.pushState | typeof history.replaceState, location: URL, restorationIdentifier: string): void
}

export interface VisitView {
  renderPromise?: Promise<void>
  forceReloaded: boolean
  lastRenderedLocation: URL
  shouldPreserveScrollPosition(visit: Visit): boolean
  scrollToPosition(position: ScrollPosition): void
  scrollToAnchor(anchor: string): void
  scrollToTop(): void
  getCachedSnapshotForLocation(location: URL): PageSnapshot | undefined
  renderError(snapshot: PageSnapshot, visit: Visit): Promise<void>
  isPageRefresh(visit: Visit): boolean
  renderPage(snapshot: PageSnapshot, isPreview?: boolean, willRender?: boolean, visit?: Visit): Promise<void>
  cacheSnapshot(snapshot?: PageSnapshot): Promise<PageSnapshot | undefined>
}

export interface RestorationData {
  scrollPosition?: ScrollPosition
  [key: string]: any
}

export interface ScrollPosition {
  x: number
  y: number
}

export interface VisitOptions {
  action?: string
  historyChanged?: boolean
  referrer?: URL
  snapshot?: PageSnapshot
  snapshotHTML?: string
  response?: FetchResponse
  visitCachedSnapshot?: () => void
  willRender?: boolean
  updateHistory?: boolean
  shouldCacheSnapshot?: boolean
  acceptsStreamResponse?: boolean
  direction?: string
}

// Create properly typed default values
const defaultOptions = {
  action: "advance",
  historyChanged: false,
  // Use null assertion operator for optional properties that might be undefined
  referrer: null as unknown as URL,
  snapshot: null as unknown as PageSnapshot,
  snapshotHTML: null as unknown as string,
  response: null as unknown as FetchResponse,
  visitCachedSnapshot: () => {},
  willRender: true,
  updateHistory: true,
  shouldCacheSnapshot: true,
  acceptsStreamResponse: false,
  direction: null as unknown as string
} as Required<VisitOptions>

export const TimingMetric = {
  visitStart: "visitStart",
  requestStart: "requestStart",
  requestEnd: "requestEnd",
  visitEnd: "visitEnd"
} as const

export type TimingMetricName = typeof TimingMetric[keyof typeof TimingMetric]

export const VisitState = {
  initialized: "initialized",
  started: "started",
  canceled: "canceled",
  failed: "failed",
  completed: "completed"
} as const

export type VisitStateType = typeof VisitState[keyof typeof VisitState]

export const SystemStatusCode = {
  networkFailure: 0,
  timeoutFailure: -1,
  contentTypeMismatch: -2
} as const

export const Direction = {
  advance: "forward",
  restore: "back",
  replace: "none"
} as const

export class Visit {
  readonly identifier: string = uuid()
  readonly timingMetrics: Record<TimingMetricName, number> = {} as Record<TimingMetricName, number>
  readonly delegate: VisitDelegate
  readonly location: URL
  readonly restorationIdentifier: string

  action: string
  historyChanged: boolean = false
  referrer?: URL
  snapshot?: PageSnapshot
  snapshotHTML?: string
  response?: FetchResponse
  redirectedToLocation?: URL
  request?: FetchRequest
  followedRedirect: boolean = false
  scrolled: boolean = false
  shouldCacheSnapshot: boolean = true
  acceptsStreamResponse: boolean = false
  snapshotCached: boolean = false
  isSamePage: boolean
  isPageRefresh: boolean
  state: VisitStateType = VisitState.initialized
  viewTransitioner: ViewTransitioner = new ViewTransitioner()
  willRender: boolean
  updateHistory: boolean
  visitCachedSnapshot: () => void
  direction: string
  frame?: number

  constructor(
    delegate: VisitDelegate,
    location: URL,
    restorationIdentifier?: string,
    options: VisitOptions = {}
  ) {
    this.delegate = delegate
    this.location = location
    this.restorationIdentifier = restorationIdentifier || uuid()

    const {
      action,
      historyChanged,
      referrer,
      snapshot,
      snapshotHTML,
      response,
      visitCachedSnapshot,
      willRender,
      updateHistory,
      shouldCacheSnapshot,
      acceptsStreamResponse,
      direction
    } = {
      ...defaultOptions,
      ...options
    }

    this.action = action
    this.historyChanged = historyChanged
    this.referrer = referrer
    this.snapshot = snapshot
    this.snapshotHTML = snapshotHTML
    this.response = response
    this.isSamePage = this.delegate.locationWithActionIsSamePage(this.location, this.action)
    this.isPageRefresh = this.view.isPageRefresh(this)
    this.visitCachedSnapshot = visitCachedSnapshot
    this.willRender = willRender
    this.updateHistory = updateHistory
    this.scrolled = !willRender
    this.shouldCacheSnapshot = shouldCacheSnapshot
    this.acceptsStreamResponse = acceptsStreamResponse
    this.direction = direction || Direction[action as keyof typeof Direction] || Direction.advance
  }

  get adapter(): VisitAdapter {
    return this.delegate.adapter
  }

  get view(): VisitView {
    return this.delegate.view
  }

  get history(): VisitHistory {
    return this.delegate.history
  }

  get restorationData(): RestorationData {
    return this.history.getRestorationDataForIdentifier(this.restorationIdentifier)
  }

  get silent(): boolean {
    return this.isSamePage
  }

  start(): void {
    if (this.state === VisitState.initialized) {
      this.recordTimingMetric(TimingMetric.visitStart)
      this.state = VisitState.started
      this.adapter.visitStarted(this)
      this.delegate.visitStarted(this)
    }
  }

  cancel(): void {
    if (this.state === VisitState.started) {
      if (this.request) {
        this.request.cancel()
      }
      this.cancelRender()
      this.state = VisitState.canceled
    }
  }

  complete(): void {
    if (this.state === VisitState.started) {
      this.recordTimingMetric(TimingMetric.visitEnd)
      this.state = VisitState.completed
      this.adapter.visitCompleted(this)
      this.followRedirect()

      if (!this.followedRedirect) {
        this.delegate.visitCompleted(this)
      }
    }
  }

  fail(): void {
    if (this.state === VisitState.started) {
      this.state = VisitState.failed
      this.adapter.visitFailed(this)
      this.delegate.visitCompleted(this)
    }
  }

  changeHistory(): void {
    if (!this.historyChanged && this.updateHistory) {
      // Use type assertion to ensure actionForHistory is of type Action
      const actionForHistory = this.location.href === this.referrer?.href ? "replace" : this.action
      const method = getHistoryMethodForAction(actionForHistory as "replace" | "advance" | "restore")
      this.history.update(method, this.location, this.restorationIdentifier)
      this.historyChanged = true
    }
  }

  issueRequest(): void {
    if (this.hasPreloadedResponse()) {
      this.simulateRequest()
    } else if (this.shouldIssueRequest() && !this.request) {
      this.request = new FetchRequest(this, FetchMethod.get, this.location)
      this.request.perform()
    }
  }

  simulateRequest(): void {
    if (this.response) {
      this.startRequest()
      this.recordResponse()
      this.finishRequest()
    }
  }

  startRequest(): void {
    this.recordTimingMetric(TimingMetric.requestStart)
    this.adapter.visitRequestStarted(this)
  }

  recordResponse(response = this.response): void {
    this.response = response
    if (response) {
      const { statusCode } = response
      if (isSuccessful(statusCode)) {
        this.adapter.visitRequestCompleted(this)
      } else {
        this.adapter.visitRequestFailedWithStatusCode(this, statusCode)
      }
    }
  }

  finishRequest(): void {
    this.recordTimingMetric(TimingMetric.requestEnd)
    this.adapter.visitRequestFinished(this)
  }

  loadResponse(): void {
    if (this.response) {
      const { statusCode, responseHTML } = this.response
      this.render(async () => {
        if (this.shouldCacheSnapshot) this.cacheSnapshot()
        if (this.view.renderPromise) await this.view.renderPromise

        if (isSuccessful(statusCode) && responseHTML != null) {
          // Ensure responseHTML is a string before passing to fromHTMLString
          const snapshot = PageSnapshot.fromHTMLString(responseHTML.toString())
          await this.renderPageSnapshot(snapshot, false)

          this.adapter.visitRendered(this)
          this.complete()
        } else {
          // Ensure responseHTML is a string or provide a fallback
          const html = responseHTML ? responseHTML.toString() : ""
          await this.view.renderError(PageSnapshot.fromHTMLString(html), this)
          this.adapter.visitRendered(this)
          this.fail()
        }
      })
    }
  }

  getCachedSnapshot(): PageSnapshot | undefined {
    const snapshot = this.view.getCachedSnapshotForLocation(this.location) || this.getPreloadedSnapshot()

    if (snapshot && (!getAnchor(this.location) || snapshot.hasAnchor(getAnchor(this.location) || null))) {
      if (this.action === "restore" || snapshot.isPreviewable) {
        return snapshot
      }
    }
  }

  getPreloadedSnapshot(): PageSnapshot | undefined {
    if (this.snapshotHTML) {
      return PageSnapshot.fromHTMLString(this.snapshotHTML)
    }
  }

  hasCachedSnapshot(): boolean {
    return this.getCachedSnapshot() != null
  }

  loadCachedSnapshot(): void {
    const snapshot = this.getCachedSnapshot()
    if (snapshot) {
      const isPreview = this.shouldIssueRequest()
      this.render(async () => {
        this.cacheSnapshot()
        if (this.isSamePage || this.isPageRefresh) {
          this.adapter.visitRendered(this)
        } else {
          if (this.view.renderPromise) await this.view.renderPromise

          await this.renderPageSnapshot(snapshot, isPreview)

          this.adapter.visitRendered(this)
          if (!isPreview) {
            this.complete()
          }
        }
      })
    }
  }

  followRedirect(): void {
    if (this.redirectedToLocation && !this.followedRedirect && this.response?.redirected) {
      this.adapter.visitProposedToLocation(this.redirectedToLocation, {
        action: "replace",
        response: this.response,
        shouldCacheSnapshot: false,
        willRender: false
      })
      this.followedRedirect = true
    }
  }

  goToSamePageAnchor(): void {
    if (this.isSamePage) {
      this.render(async () => {
        this.cacheSnapshot()
        this.performScroll()
        this.changeHistory()
        this.adapter.visitRendered(this)
      })
    }
  }

  // Fetch request delegate

  prepareRequest(request: FetchRequest): void {
    if (this.acceptsStreamResponse) {
      request.acceptResponseType(StreamMessage.contentType)
    }
  }

  requestStarted(): void {
    this.startRequest()
  }

  requestPreventedHandlingResponse(_request: FetchRequest, _response: FetchResponse): void {}

  async requestSucceededWithResponse(request: FetchRequest, response: FetchResponse): Promise<void> {
    const responseHTML = await response.responseHTML
    const { redirected, statusCode } = response
    if (responseHTML == undefined) {
      this.recordResponse({
        statusCode: SystemStatusCode.contentTypeMismatch,
        redirected,
        response: response.response,
        succeeded: false,
        failed: true,
        clientError: false,
        serverError: false,
        location: response.location,
        contentType: response.contentType,
        responseText: response.responseText,
        responseHTML: Promise.resolve(undefined)
      } as FetchResponse)
    } else {
      this.redirectedToLocation = response.redirected ? response.location : undefined
      this.recordResponse({
        statusCode: statusCode,
        responseHTML: Promise.resolve(responseHTML),
        redirected,
        response: response.response,
        succeeded: statusCode >= 200 && statusCode < 300,
        failed: statusCode < 200 || statusCode >= 300,
        clientError: statusCode >= 400 && statusCode <= 499,
        serverError: statusCode >= 500 && statusCode <= 599,
        location: response.location,
        contentType: response.contentType,
        responseText: Promise.resolve(responseHTML)
      } as FetchResponse)
    }
  }

  async requestFailedWithResponse(request: FetchRequest, response: FetchResponse): Promise<void> {
    const responseHTML = await response.responseHTML
    const { redirected, statusCode } = response
    if (responseHTML == undefined) {
      this.recordResponse({
        statusCode: SystemStatusCode.contentTypeMismatch,
        redirected,
        response: response.response,
        succeeded: false,
        failed: true,
        clientError: false,
        serverError: false,
        location: response.location,
        contentType: response.contentType,
        responseText: response.responseText,
        responseHTML: Promise.resolve(undefined)
      } as FetchResponse)
    } else {
      this.recordResponse({
        statusCode: statusCode,
        responseHTML: Promise.resolve(responseHTML),
        redirected,
        response: response.response,
        succeeded: false,
        failed: true,
        clientError: statusCode >= 400 && statusCode <= 499,
        serverError: statusCode >= 500 && statusCode <= 599,
        location: response.location,
        contentType: response.contentType,
        responseText: Promise.resolve(responseHTML)
      } as FetchResponse)
    }
  }

  requestErrored(_request: FetchRequest, _error: Error): void {
    this.recordResponse({
      statusCode: SystemStatusCode.networkFailure,
      redirected: false,
      response: new Response(),
      succeeded: false,
      failed: true,
      clientError: false,
      serverError: false,
      location: this.location,
      contentType: null,
      responseText: Promise.resolve(""),
      responseHTML: Promise.resolve(undefined)
    } as FetchResponse)
  }

  requestFinished(): void {
    this.finishRequest()
  }

  // Scrolling

  performScroll(): void {
    if (!this.scrolled && !this.view.forceReloaded && !this.view.shouldPreserveScrollPosition(this)) {
      if (this.action === "restore") {
        this.scrollToRestoredPosition() || this.scrollToAnchor() || this.view.scrollToTop()
      } else {
        this.scrollToAnchor() || this.view.scrollToTop()
      }
      if (this.isSamePage) {
        this.delegate.visitScrolledToSamePageLocation(this.view.lastRenderedLocation, this.location)
      }

      this.scrolled = true
    }
  }

  scrollToRestoredPosition(): boolean {
    const { scrollPosition } = this.restorationData
    if (scrollPosition) {
      this.view.scrollToPosition(scrollPosition)
      return true
    }
    return false
  }

  scrollToAnchor(): boolean {
    const anchor = getAnchor(this.location)
    if (anchor != null) {
      this.view.scrollToAnchor(anchor)
      return true
    }
    return false
  }

  // Instrumentation

  recordTimingMetric(metric: TimingMetricName): void {
    this.timingMetrics[metric] = new Date().getTime()
  }

  getTimingMetrics(): Record<TimingMetricName, number> {
    return { ...this.timingMetrics }
  }

  // Private

  hasPreloadedResponse(): boolean {
    return typeof this.response === "object"
  }

  shouldIssueRequest(): boolean {
    if (this.isSamePage) {
      return false
    } else if (this.action === "restore") {
      return !this.hasCachedSnapshot()
    } else {
      return this.willRender
    }
  }

  cacheSnapshot(): void {
    if (!this.snapshotCached) {
      this.view.cacheSnapshot().then((snapshot: PageSnapshot | undefined) => {
        if (snapshot) {
          this.visitCachedSnapshot()
        }
      })
      this.snapshotCached = true
    }
  }

  async render(callback: () => Promise<void>): Promise<void> {
    this.cancelRender()

    this.frame = await new Promise<number>(resolve => requestAnimationFrame(resolve))
    await callback()
    delete this.frame
  }

  async renderPageSnapshot(snapshot: PageSnapshot, isPreview: boolean): Promise<void> {
    await this.view.renderPage(snapshot, isPreview, true, this)
  }

  cancelRender(): void {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame)
      delete this.frame
    }
  }
}

function isSuccessful(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300
}
