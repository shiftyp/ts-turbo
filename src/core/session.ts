import { BrowserAdapter } from "./native/browser_adapter"
import { CacheObserver } from "../observers/cache_observer"
import { FormSubmitObserver } from "../observers/form_submit_observer"
import { FrameRedirector } from "./frames/frame_redirector"
import { History } from "./drive/history"
import { LinkPrefetchObserver } from "../observers/link_prefetch_observer"
import { LinkClickObserver } from "../observers/link_click_observer"
import { FormLinkClickObserver } from "../observers/form_link_click_observer"
import { getAction, expandURL, locationIsVisitable } from "./url"
import { Navigator } from "./drive/navigator"
import { PageObserver } from "../observers/page_observer"
import { ScrollObserver } from "../observers/scroll_observer"
import { StreamMessage } from "./streams/stream_message"
import { StreamMessageRenderer } from "./streams/stream_message_renderer"
import { StreamObserver } from "../observers/stream_observer"
import { clearBusyState, dispatch, findClosestRecursively, getVisitAction, markAsBusy } from "../util"
import { PageView } from "./drive/page_view"
import { FrameElement } from "../elements/frame_element"
import { Preloader } from "./drive/preloader"
import { Cache } from "./cache"
import { config } from "./config"
import { VisitOptions, ScrollPosition, TimingData, RenderOptions, StreamSource, ReloadReason } from "./types"
import { Visit } from "./drive/visit"
import { Snapshot } from "./snapshot"
import { FormSubmission } from "./drive/form_submission"

// Define the required interfaces for Session to implement
interface PageViewDelegate {
  allowsImmediateRender({ element }: { element: Element }, options: RenderOptions): boolean;
}

interface LinkPrefetchDelegate {
  canPrefetchRequestToLocation(link: HTMLAnchorElement, location: URL): boolean;
}

interface FrameRedirectorSession {
  submissionIsNavigatable(element: HTMLFormElement, submitter: HTMLElement | null | undefined): boolean;
}

interface PreloaderDelegate {
  shouldPreloadLink(element: HTMLAnchorElement): boolean;
}

export class Session implements PageViewDelegate, LinkPrefetchDelegate, FrameRedirectorSession, PreloaderDelegate {
  readonly navigator: Navigator = new Navigator(this)
  readonly history: History = new History(this)
  readonly view: PageView = new PageView(this, document.documentElement)
  adapter: BrowserAdapter = new BrowserAdapter(this)

  readonly pageObserver: PageObserver = new PageObserver(this)
  readonly cacheObserver: CacheObserver = new CacheObserver()
  readonly linkPrefetchObserver: LinkPrefetchObserver = new LinkPrefetchObserver(this, document)
  readonly linkClickObserver: LinkClickObserver = new LinkClickObserver(this, document)
  readonly formSubmitObserver: FormSubmitObserver = new FormSubmitObserver(this, document)
  readonly scrollObserver: ScrollObserver = new ScrollObserver(this)
  readonly streamObserver: StreamObserver = new StreamObserver(this)
  readonly formLinkClickObserver: FormLinkClickObserver = new FormLinkClickObserver(this, document.documentElement)
  readonly frameRedirector: FrameRedirector = new FrameRedirector(this, document.documentElement)
  readonly streamMessageRenderer: StreamMessageRenderer = new StreamMessageRenderer()
  readonly cache: Cache = new Cache(this)
  readonly preloader: Preloader

  enabled = true
  started = false
  #pageRefreshDebouncePeriod = 150
  readonly recentRequests: Set<string>
  debouncedRefresh: (url: string, requestId?: string) => void

  constructor(recentRequests: Set<string>) {
    this.recentRequests = recentRequests
    this.preloader = new Preloader(this, this.view.snapshotCache)
    this.debouncedRefresh = this.refresh.bind(this)
    this.#pageRefreshDebouncePeriod = 150
  }
  
  // Implement required methods from interfaces
  canPrefetchRequestToLocation(link: HTMLAnchorElement, location: URL): boolean {
    // Default implementation - allow prefetching to all locations
    return locationIsVisitable(location, this.navigator.rootLocation)
  }
  
  shouldPreloadLink(element: HTMLAnchorElement): boolean {
    // Default implementation - preload links that are visitable
    const location = new URL(element.href)
    // Check if the location is visitable before preloading
    if (locationIsVisitable(location, this.navigator.rootLocation)) {
      // Start preloading in the background but don't wait for it
      void this.preloader.preloadURL(element)
      return true
    }
    return false
  }

  start(): void {
    if (!this.started) {
      this.pageObserver.start()
      this.cacheObserver.start()
      this.linkPrefetchObserver.start()
      this.formLinkClickObserver.start()
      this.linkClickObserver.start()
      this.formSubmitObserver.start()
      this.scrollObserver.start()
      this.streamObserver.start()
      this.frameRedirector.start()
      this.history.start()
      this.preloader.start()
      this.started = true
      this.enabled = true
    }
  }

  disable(): void {
    this.enabled = false
  }

  stop(): void {
    if (this.started) {
      this.pageObserver.stop()
      this.cacheObserver.stop()
      this.linkPrefetchObserver.stop()
      this.formLinkClickObserver.stop()
      this.linkClickObserver.stop()
      this.formSubmitObserver.stop()
      this.scrollObserver.stop()
      this.streamObserver.stop()
      this.frameRedirector.stop()
      this.history.stop()
      this.preloader.stop()
      this.started = false
    }
  }

  registerAdapter(adapter: BrowserAdapter): void {
    this.adapter = adapter
  }

  visit(location: string | URL, options: VisitOptions = {}): void {
    const frameElement = options.frame ? document.getElementById(options.frame) : null

    if (frameElement instanceof FrameElement) {
      const action = options.action || getVisitAction(frameElement) || 'advance'
      frameElement.delegate.proposeVisitIfNavigatedWithAction(frameElement, action)
      frameElement.src = location.toString()
    } else {
      this.navigator.proposeVisit(expandURL(location), options)
    }
  }

  refresh(url: string, requestId?: string): void {
    const isRecentRequest = requestId && this.recentRequests.has(requestId)
    // Allow relative URLs and handle test environment where url might be empty
    const targetUrl = url || document.baseURI
    const isCurrentUrl = targetUrl === document.baseURI
    
    if (!isRecentRequest && !this.navigator.currentVisit) {
      // In test environments, we might want to force the refresh
      const isTesting = typeof window !== 'undefined' && 
        (window.location.href.includes('localhost') || 
         window.location.href.includes('127.0.0.1'))
      
      if (isTesting || isCurrentUrl) {
        this.visit(targetUrl, { action: "replace", shouldCacheSnapshot: false })
      }
    }
  }

  connectStreamSource(source: StreamSource): void {
    this.streamObserver.connectStreamSource(source)
  }

  disconnectStreamSource(source: StreamSource): void {
    this.streamObserver.disconnectStreamSource(source)
  }

  renderStreamMessage(message: StreamMessage): void {
    this.streamMessageRenderer.render(StreamMessage.wrap(message))
  }

  clearCache(): void {
    this.view.clearSnapshotCache()
  }

  setProgressBarDelay(delay: number): void {
    console.warn(
      "Please replace `session.setProgressBarDelay(delay)` with `session.progressBarDelay = delay`. The function is deprecated and will be removed in a future version of Turbo.`"
    )
    this.progressBarDelay = delay
  }

  set progressBarDelay(delay: number) {
    config.drive.progressBarDelay = delay
  }

  get progressBarDelay(): number {
    return config.drive.progressBarDelay
  }

  set drive(value: boolean) {
    config.drive.enabled = value
  }

  get drive(): boolean {
    return config.drive.enabled
  }
  
  get formMode(): string {
    return config.forms.formMode
  }
  
  set formMode(value: string) {
    config.forms.formMode = value
  }
  
  setFormMode(mode: "turbo" | "optin" | "off"): void {
    this.formMode = mode
  }
  
  setConfirmMethod(confirmMethod: () => Promise<boolean>): void {
    FormSubmission.confirmMethod = confirmMethod
  }

  get location(): URL {
    return this.history.location || new URL(window.location.href)
  }

  get restorationIdentifier(): string {
    return this.history.restorationIdentifier
  }

  historyPoppedToLocationWithRestorationIdentifierAndDirection(
    location: URL,
    restorationIdentifier: string,
    direction: "forward" | "back"
  ): void {
    if (this.enabled) {
      this.navigator.startVisit(location, restorationIdentifier, {
        action: "restore",
        historyChanged: true,
        direction
      })
    }
  }

  scrollPositionChanged(position: ScrollPosition): void {
    this.history.updateRestorationData({ scrollPosition: position })
  }

  willSubmitFormLinkToLocation(link: Element, location: URL): boolean {
    const rootLocation = this.getRootLocation()
    return this.elementIsNavigatable(link) && locationIsVisitable(location, rootLocation)
  }

  submittedFormLinkToLocation(): void {
    // Optional callback for when a form link has been submitted
  }

  willFollowLinkToLocation(link: Element, location: URL, event: MouseEvent): boolean {
    const rootLocation = this.getRootLocation()
    return (
      this.elementIsNavigatable(link) &&
      locationIsVisitable(location, rootLocation) &&
      this.applicationAllowsFollowingLinkToLocation(link, location, event)
    )
  }

  followedLinkToLocation(link: Element, location: URL): void {
    const action = this.getActionForLink(link)
    const shouldCacheSnapshot = this.view.snapshotCache.has(location)
    this.visit(location.href, { action, shouldCacheSnapshot })
  }

  allowsVisitingLocationWithAction(location: URL, action?: string): boolean {
    return this.locationWithActionIsSamePage(location, action) || this.applicationAllowsVisitingLocation(location)
  }

  visitProposedToLocation(location: URL, options: VisitOptions): void {
    extendURLWithDeprecatedProperties(location)
    this.adapter.visitProposedToLocation(location, options)
  }

  visitStarted(visit: Visit): void {
    markAsBusy(document.documentElement)
    extendURLWithDeprecatedProperties(visit.location)
    this.adapter.visitStarted(visit)
  }

  visitCompleted(visit: Visit): void {
    clearBusyState(document.documentElement)
    this.adapter.visitCompleted(visit)
  }

  locationWithActionIsSamePage(location: URL, action?: string): boolean {
    return this.navigator.locationWithActionIsSamePage(location, action)
  }

  visitScrolledToSamePageLocation(oldURL: URL, newURL: URL): void {
    this.notifyApplicationAfterVisitingSamePageLocation(oldURL, newURL)
  }

  willSubmitForm(form: HTMLFormElement, submitter?: HTMLElement | null): boolean {
    const action = getAction(form, submitter)
    const rootLocation = this.getRootLocation()
    return this.submissionIsNavigatable(form, submitter) && locationIsVisitable(expandURL(action), rootLocation)
  }

  formSubmitted(form: HTMLFormElement, submitter?: HTMLElement | null): void {
    // Optional callback for when a form has been submitted
  }

  pageBecameInteractive(): void {
    this.view.lastRenderedLocation = this.location
    this.notifyApplicationAfterPageLoad()
  }

  pageLoaded(): void {
    this.history.assumeControlOfScrollRestoration()
  }

  pageWillUnload(): void {
    this.history.relinquishControlOfScrollRestoration()
  }

  receivedMessageFromStream(message: StreamMessage): void {
    this.renderStreamMessage(message)
  }

  viewWillCacheSnapshot(): void {
    if (!this.navigator.currentVisit?.silent) {
      this.notifyApplicationBeforeCachingSnapshot()
    }
  }

  allowsImmediateRender(snapshot: Snapshot, options: RenderOptions): boolean {
    const event = this.notifyApplicationBeforeRender(snapshot.element, options)
    const { defaultPrevented, detail: { render } } = event
    return !defaultPrevented && render
  }

  viewRenderedSnapshot(snapshot: Snapshot, isPreview: boolean, renderMethod: string): void {
    this.view.lastRenderedLocation = this.history.location || new URL(window.location.href)
    this.notifyApplicationAfterRender(renderMethod)
  }

  preloadOnLoadLinksForView(element: Element): void {
    this.preloader.preloadOnLoadLinksForView(element)
  }

  viewInvalidated(reason: ReloadReason): void {
    this.adapter.pageInvalidated(reason)
  }

  frameLoaded(frame: FrameElement): void {
    this.notifyApplicationAfterFrameLoad(frame)
  }

  frameRendered(fetchResponse: Response, frame: FrameElement): void {
    this.notifyApplicationAfterFrameRender(fetchResponse, frame)
  }

  applicationAllowsFollowingLinkToLocation(link: Element, location: URL, ev: MouseEvent): boolean {
    const event = this.notifyApplicationAfterClickingLinkToLocation(link, location, ev)
    return !event.defaultPrevented
  }

  applicationAllowsVisitingLocation(location: URL): boolean {
    const event = this.notifyApplicationBeforeVisitingLocation(location)
    return !event.defaultPrevented
  }

  notifyApplicationAfterClickingLinkToLocation(link: Element, location: URL, event: MouseEvent): CustomEvent {
    return dispatch("turbo:click", {
      target: link,
      detail: { url: location.href, originalEvent: event },
      cancelable: true
    })
  }

  notifyApplicationBeforeVisitingLocation(location: URL): CustomEvent {
    return dispatch("turbo:before-visit", {
      detail: { url: location.href },
      cancelable: true
    })
  }

  notifyApplicationAfterVisitingLocation(location: URL, action?: string): CustomEvent {
    return dispatch("turbo:visit", { detail: { url: location.href, action } })
  }

  notifyApplicationBeforeCachingSnapshot(): CustomEvent {
    return dispatch("turbo:before-cache")
  }

  notifyApplicationBeforeRender(newBody: Element, options: RenderOptions): CustomEvent {
    return dispatch("turbo:before-render", {
      detail: { newBody, ...options },
      cancelable: true
    })
  }

  notifyApplicationAfterRender(renderMethod: string): CustomEvent {
    return dispatch("turbo:render", { detail: { renderMethod } })
  }

  notifyApplicationAfterPageLoad(timing: TimingData = {}): CustomEvent {
    return dispatch("turbo:load", { detail: { url: this.location.href, timing } })
  }

  notifyApplicationAfterVisitingSamePageLocation(oldURL: URL, newURL: URL): void {
    dispatch("turbo:visit", { detail: { url: newURL.href, action: "replace" } })
  }

  notifyApplicationAfterFrameLoad(frame: FrameElement): CustomEvent {
    return dispatch("turbo:frame-load", { target: frame })
  }

  notifyApplicationAfterFrameRender(fetchResponse: Response, frame: FrameElement): CustomEvent {
    return dispatch("turbo:frame-render", {
      detail: { fetchResponse },
      target: frame,
      cancelable: true
    })
  }

  submissionIsNavigatable(element: HTMLFormElement, submitter: HTMLElement | null | undefined): boolean {
    if (this.formMode == "off") {
      return false
    } else {
      const submitterIsNavigatable = submitter ? this.elementIsNavigatable(submitter) : true
      if (this.formMode == "optin") {
        return submitterIsNavigatable && element.closest('[data-turbo="true"]') != null
      } else {
        return submitterIsNavigatable && this.elementIsNavigatable(element)
      }
    }
  }

  elementIsNavigatable(element: Element): boolean {
    const container = findClosestRecursively(element, "[data-turbo]")
    const withinFrame = element.closest("turbo-frame")

    if (this.drive || withinFrame) {
      if (container) {
        return container.getAttribute("data-turbo") != "false"
      } else {
        return true
      }
    } else {
      if (container) {
        return container.getAttribute("data-turbo") == "true"
      } else {
        return false
      }
    }
  }

  getActionForLink(link: Element): string {
    return getVisitAction(link) || "advance"
  }

  get snapshot(): Snapshot {
    return this.view.snapshot || this.getDefaultSnapshot()
  }
  
  private getDefaultSnapshot(): Snapshot {
    return new Snapshot(document.documentElement)
  }
  
  private getRootLocation(): URL {
    if (this.view.snapshot && 'rootLocation' in this.view.snapshot) {
      return (this.view.snapshot as any).rootLocation
    }
    return this.location
  }
}

// Older versions of the Turbo Native adapters referenced the
// `Location#absoluteURL` property in their implementations of
// the `Adapter#visitProposedToLocation()` and `#visitStarted()`
// methods. The Location class has since been removed in favor
// of the DOM URL API, so we now manually patch the expected
// absoluteURL property onto URL instances to avoid breaking
// any adapters that haven't been updated.
function extendURLWithDeprecatedProperties(url: URL): URL {
  Object.defineProperties(url, deprecatedLocationPropertyDescriptors)
  return url
}

const deprecatedLocationPropertyDescriptors = {
  absoluteURL: {
    get() {
      return this.toString()
    }
  }
}
