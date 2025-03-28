import { FrameElement, FrameLoadingStyle, getFrameElementById } from "../../elements/frame_element"
import { FetchMethod, FetchRequest, FetchRequestDelegate } from "../../http/fetch_request"
import { FetchResponse } from "../../http/fetch_response"
import { AppearanceObserver } from "../../observers/appearance_observer"
import {
  clearBusyState,
  dispatch,
  getAttribute,
  parseHTMLDocument,
  markAsBusy,
  uuid,
  getHistoryMethodForAction,
  getVisitAction
} from "../../util"
import { FormSubmission } from "../drive/form_submission"
import { Snapshot } from "../snapshot"
import { ReloadReason } from "../types"
import { getAction, expandURL, urlsAreEqual, locationIsVisitable } from "../url"
import { FormSubmitObserver, FormSubmitDelegate } from "../../observers/form_submit_observer"
import { FrameView } from "./frame_view"
import { LinkInterceptor, LinkInterceptorDelegate } from "./link_interceptor"
import { FormLinkClickObserver, FormLinkClickDelegate } from "../../observers/form_link_click_observer"
import { FrameRenderer } from "./frame_renderer"
import { MorphingFrameRenderer } from "./morphing_frame_renderer"
import { session } from "../index"
import { StreamMessage } from "../streams/stream_message"
import { PageSnapshot } from "../drive/page_snapshot"
import { TurboFrameMissingError } from "../errors"

const defaultOptions = {
  action: "advance",
  historyChanged: false,
  visitCachedSnapshot: () => {},
  willRender: true,
  updateHistory: true,
  shouldCacheSnapshot: true,
  acceptsStreamResponse: false
} as const

export type RenderOptions = {
  resume: (value: unknown) => void
  render: () => Promise<void>
  renderMethod: string
}

export type Action = "advance" | "replace" | "restore"

export interface ViewDelegate {
  allowsImmediateRender(snapshot: Snapshot, options: RenderOptions): boolean
  viewRenderedSnapshot(snapshot: Snapshot, isPreview: boolean, renderMethod: string): void
  preloadOnLoadLinksForView(element: Element): void
  viewInvalidated(reason: ReloadReason): void
}

export class FrameController implements ViewDelegate, FormLinkClickDelegate, LinkInterceptorDelegate, FormSubmitDelegate, FetchRequestDelegate {
  // ViewDelegate implementation
  allowsImmediateRender(snapshot: Snapshot, options: RenderOptions): boolean {
    return true
  }

  viewRenderedSnapshot(snapshot: Snapshot, isPreview: boolean, renderMethod: string): void {
    // Implementation
  }

  preloadOnLoadLinksForView(element: Element): void {
    // Implementation
  }

  viewInvalidated(reason: ReloadReason): void {
    // Implementation
  }
  
  // FetchRequestDelegate implementation
  prepareRequest(request: FetchRequest): void {
    request.headers.set("Turbo-Frame", this.id)

    if (this.#currentNavigationElement?.hasAttribute("data-turbo-stream")) {
      request.acceptResponseType(StreamMessage.contentType)
    }
  }
  
  requestStarted(request: FetchRequest): void {
    // Implementation
  }
  
  requestPreventedHandlingResponse(request: FetchRequest, response: FetchResponse): void {
    // Implementation
  }
  
  async requestSucceededWithResponse(request: FetchRequest, response: FetchResponse): Promise<void> {
    await this.fetchResponseLoaded(response)
  }
  
  requestFailedWithResponse(request: FetchRequest, response: FetchResponse): Promise<void> {
    return Promise.resolve()
  }
  
  requestErrored(request: FetchRequest, error: Error): void {
    // Implementation
  }
  
  requestFinished(request: FetchRequest): void {
    // Implementation
  }

  // FormLinkClickDelegate implementation
  willSubmitFormLinkToLocation(link: HTMLAnchorElement, location: URL, event: MouseEvent): boolean {
    return true
  }

  submittedFormLinkToLocation(link: HTMLAnchorElement, location: URL, form: HTMLFormElement): void {
    // Implementation
  }
  readonly element: FrameElement
  readonly view: FrameView
  readonly appearanceObserver: AppearanceObserver
  readonly formLinkClickObserver: FormLinkClickObserver
  readonly linkInterceptor: LinkInterceptor
  readonly formSubmitObserver: FormSubmitObserver
  readonly restorationIdentifier: string

  fetchResponseLoaded = (_fetchResponse: FetchResponse): Promise<void> => Promise.resolve()
  #currentFetchRequest: FetchRequest | null = null
  #resolveVisitPromise = (_value: any = {}) => {}
  #connected = false
  #hasBeenLoaded = false
  #ignoredAttributes = new Set<string>()
  #shouldMorphFrame = false
  #progressBarTimeout?: number
  #progressBar?: any
  #progressBarDelay = 500
  #currentNavigationElement?: HTMLElement
  #formSubmission?: FormSubmission
  #savingHistory = false
  
  action: Action | null = null
  referrer?: URL

  constructor(element: FrameElement) {
    this.element = element
    this.view = new FrameView(this, this.element)
    this.appearanceObserver = new AppearanceObserver(this, this.element)
    this.formLinkClickObserver = new FormLinkClickObserver(this, this.element)
    this.linkInterceptor = new LinkInterceptor(this, this.element)
    this.restorationIdentifier = uuid()
    this.formSubmitObserver = new FormSubmitObserver(this, this.element)
  }

  // Frame delegate

  connect(): void {
    if (!this.#connected) {
      this.#connected = true
      if (this.loadingStyle == FrameLoadingStyle.lazy) {
        this.appearanceObserver.start()
      } else {
        this.#loadSourceURL()
      }
      this.formLinkClickObserver.start()
      this.linkInterceptor.start()
      this.formSubmitObserver.start()
    }
  }

  disconnect(): void {
    if (this.#connected) {
      this.#connected = false
      this.appearanceObserver.stop()
      this.formLinkClickObserver.stop()
      this.linkInterceptor.stop()
      this.formSubmitObserver.stop()
    }
  }

  disabledChanged(): void {
    if (this.loadingStyle == FrameLoadingStyle.eager) {
      this.#loadSourceURL()
    }
  }

  sourceURLChanged(): void {
    if (this.#isIgnoringChangesTo("src")) return

    if (this.element.isConnected) {
      this.complete = false
    }

    if (this.loadingStyle == FrameLoadingStyle.eager || this.#hasBeenLoaded) {
      this.#loadSourceURL()
    }
  }

  sourceURLReloaded(): Promise<void> {
    const { refresh, src } = this.element

    this.#shouldMorphFrame = src !== null && refresh === "morph"

    this.element.removeAttribute("complete")
    this.element.src = null
    this.element.src = src as string | null
    return this.element.loaded
  }

  // Link interceptor delegate

  shouldInterceptLinkClick(element: Element, url: string, originalEvent: Event): boolean {
    const htmlElement = element as HTMLElement
    const urlObj = new URL(url)
    const mouseEvent = originalEvent as MouseEvent
    return this.#shouldInterceptNavigation(htmlElement, mouseEvent)
  }

  linkClickIntercepted(element: HTMLElement, url: URL, event: MouseEvent): void {
    this.#navigateFrame(element, url, event)
  }

  // Form submit observer delegate

  willSubmitForm(form: HTMLFormElement, submitter?: HTMLElement): boolean {
    return form.closest("turbo-frame") == this.element && this.#shouldInterceptNavigation(form, submitter)
  }

  formSubmitted(form: HTMLFormElement, submitter?: HTMLElement): void {
    if (this.#formSubmission) {
      this.#formSubmission.stop()
    }

    this.#formSubmission = new FormSubmission(this, form, submitter || undefined)
    const { fetchRequest } = this.#formSubmission
    this.prepareRequest(fetchRequest)
    this.#formSubmission.start()
  }

  // Appearance observer delegate

  elementAppearedInViewport(element: HTMLElement): void {
    this.#proposeVisitIfNavigable(element)
  }

  // Form submission delegate

  formSubmissionStarted(formSubmission: FormSubmission): void {
    markAsBusy(this.element)
    this.#showProgressBar()
  }

  async formSubmissionSucceededWithResponse(formSubmission: FormSubmission, fetchResponse: FetchResponse): Promise<void> {
    await this.#renderFrameResponse(fetchResponse)
    this.#showProgressBarAfterDelay()
  }

  formSubmissionFailedWithResponse(formSubmission: FormSubmission, fetchResponse: FetchResponse): void {
    this.#renderFrameResponse(fetchResponse)
  }

  formSubmissionErrored(formSubmission: FormSubmission): void {
    this.#handleError()
  }

  formSubmissionFinished(formSubmission: FormSubmission): void {
    clearBusyState(this.element)
    this.#hideProgressBar()
  }

  // Private

  #navigateFrame(element: HTMLElement, url: URL, event: MouseEvent): void {
    const turboAction = element.getAttribute("data-turbo-action")
    // Ensure action is one of the valid Action types
    const action = (turboAction || getVisitAction()) as Action

    this.#prepareHeadersForNavigation(this.#currentFetchRequest, element)
    // Pass action as a valid option matching defaultOptions type
    this.#proposeVisit(expandURL(url), { action: action as typeof defaultOptions.action })
  }

  #proposeVisitIfNavigable(element: HTMLElement): void {
    if (this.#elementIsNavigable(element)) {
      // Handle src property for iframe elements
      const src = element instanceof HTMLIFrameElement ? element.src : ""
      this.#proposeVisit(expandURL(src))
    }
  }

  #proposeVisit(url: URL, options: Partial<typeof defaultOptions> = {}): void {
    if (typeof this.#resolveVisitPromise === 'function') {
      this.#resolveVisitPromise({})
    }

    this.#savingHistory = true
    this.action = options.action as Action || "advance"

    const visitOptions = {
      visitCachedSnapshot: () => {},
      ...options,
      action: this.action
    }

    // Create a new FetchRequest with proper parameters
    const request = new FetchRequest(
      this,
      FetchMethod.get, 
      url.href
    )
    this.#currentFetchRequest = request

    this.#resolveVisitPromise = () => {}
    request.perform()
  }

  #shouldInterceptNavigation(element: HTMLElement, submitter?: HTMLElement | MouseEvent): boolean {
    const submitterFrameId = submitter && 'getAttribute' in submitter ? submitter.getAttribute("data-turbo-frame") : null
    const frameTarget = this.element.getAttribute("target")
    const id = submitterFrameId || frameTarget
    if (!this.enabled || id == "_top") {
      return false
    }

    if (id) {
      const frameElement = getFrameElementById(id)
      if (frameElement) {
        return !frameElement.disabled
      }
    }

    if (typeof (session as any).elementIsNavigatable === 'function' && !(session as any).elementIsNavigatable(element)) {
      return false
    }

    if (submitter && 'getAttribute' in submitter && typeof (session as any).elementIsNavigatable === 'function' && !(session as any).elementIsNavigatable(submitter)) {
      return false
    }

    return true
  }

  #elementIsNavigable(element: HTMLElement): boolean {
    const container = element.closest("[data-turbo]") as HTMLElement
    const withinFrame = this.element.hasAttribute("data-turbo")

    // Use a property that exists on session
    if ((session as any).drive || withinFrame) {
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

  // Fetch request delegate



  #prepareHeadersForNavigation(request: FetchRequest | null, element: HTMLElement): void {
    if (request) {
      const headers = { "Turbo-Frame": this.id }

      if (element.hasAttribute("data-turbo-action")) {
        request.headers.set("Turbo-Action", element.getAttribute("data-turbo-action") || "")
      }

      this.#currentNavigationElement = element
      
      // Set headers properly
      for (const [name, value] of Object.entries(headers)) {
        request.headers.set(name, value)
      }
    } else {
      this.#currentNavigationElement = element
    }
  }

  #handleResponse(response: FetchResponse): Promise<void> {
    if (response.redirected) {
      this.#visitResponse(response)
    } else {
      this.#renderFrameResponse(response)
    }

    return Promise.resolve()
  }

  async #renderFrameResponse(response: FetchResponse): Promise<void> {
    const markup = await response.responseHTML
    if (markup) {
      const document = parseHTMLDocument(markup)
      const element = await this.#extractForeignFrameElement(document)

      if (element) {
        await this.#loadFrameElement(element, response.response.url)
        // Use start/stop instead of flush
        this.appearanceObserver.stop()
        this.appearanceObserver.start()
        this.complete = true
      } else {
        await this.#handleError()
      }
    }
  }

  #elementIsFocused(element: HTMLElement): boolean {
    const focused = document.activeElement
    const children = Array.from(element.children)

    return focused !== null && element.contains(focused) && !children.includes(focused as Element)
  }

  #focusFirstAutofocusableElement(): boolean {
    const element = this.element.querySelector("[autofocus]") as HTMLElement | null
    if (element) {
      element.focus()
      return document.activeElement === element
    }
    return false
  }

  #loadFrameElement(frameElement: HTMLElement, url = ""): Promise<void> {
    this.#saveHistory()

    const destinationRange = document.createRange()
    destinationRange.selectNodeContents(this.element)

    const focusedElement = this.#elementIsFocused(this.element)
    const sourceRange = frameElement.ownerDocument?.createRange()
    if (sourceRange) {
      sourceRange.selectNodeContents(frameElement)
      this.element.innerHTML = ""
      this.element.appendChild(sourceRange.extractContents())
      if (!this.#focusFirstAutofocusableElement() && focusedElement) {
        const activeElement = document.activeElement
        if (activeElement instanceof HTMLElement) {
          activeElement.blur()
        }
      }
    }

    dispatch("turbo:frame-render", {
      target: this.element
    })

    if (url) {
      this.element.connectedCallback()
      dispatch("turbo:frame-load", {
        target: this.element,
        detail: { url }
      })
    }

    return Promise.resolve()
  }

  async #extractForeignFrameElement(container: Document): Promise<HTMLElement | undefined> {
    let element
    const id = CSS.escape(this.id)

    try {
      // Get the elements directly without using activateElement
      element = container.querySelector(`turbo-frame#${id}`) as HTMLElement
      if (element) {
        return element
      }

      element = container.querySelector(`turbo-frame[src][recurse~=${id}]`) as HTMLElement
      if (element) {
        await (element as any).loaded
        return await this.#extractForeignFrameElement((element as any).contentDocument)
      }
    } catch (error) {
      console.error(error)
      return new FrameElement()
    }

    return undefined
  }

  #loadSourceURL(options: Partial<typeof defaultOptions> = {}): void {
    const { visitCachedSnapshot } = { ...defaultOptions, ...options }
    this.#showProgressBar()

    if (this.element.src) {
      this.sourceURL = this.element.src
    }

    if (this.sourceURL) {
      if (this.#shouldMorphFrame) {
        this.#loadSourceURLWithMorph(this.sourceURL)
      } else {
        this.#loadSourceURLWithoutMorph(this.sourceURL, visitCachedSnapshot)
      }
    }
  }

  async #loadSourceURLWithMorph(url: string): Promise<void> {
    const shouldRender = true
    this.#saveHistory()

    await this.#renderAtURL(url, shouldRender)
  }

  #loadSourceURLWithoutMorph(url: string, visitCachedSnapshot = () => {}): void {
    this.fetchResponseLoaded = (fetchResponse: FetchResponse): Promise<void> => {
      this.#saveHistory()
      return this.#handleResponse(fetchResponse)
    }

    // Create a new FetchRequest with this controller as delegate
    this.#currentFetchRequest = new FetchRequest(
      this,
      FetchMethod.get, 
      expandURL(url).href
    )
    this.#currentFetchRequest.perform()
  }

  async #renderAtURL(url: string, shouldRender = false): Promise<void> {
    const fetchResponse = await fetch(url)
    const responseHTML = await fetchResponse.text()

    if (responseHTML) {
      const document = parseHTMLDocument(responseHTML)
      const foreignElement = await this.#extractForeignFrameElement(document)

      if (foreignElement) {
        if (shouldRender) {
          await this.#loadFrameElement(foreignElement, url)
          // Use start/stop instead of flush
          this.appearanceObserver.stop()
          this.appearanceObserver.start()
          this.complete = true
        }
      } else {
        this.#handleError()
      }
    }
  }

  #saveHistory(): void {
    if (this.#savingHistory) {
      this.#savingHistory = false
      // Use a string that's compatible with the expected input for getHistoryMethodForAction
      const historyAction = this.action || "advance"
      if ((session as any).historyManager) {
        (session as any).historyManager.update(
          getHistoryMethodForAction(historyAction), 
          expandURL(this.sourceURL || ""), 
          this.restorationIdentifier
        )
      }
    }
  }

  #handleError(): Promise<void> {
    this.#hideProgressBar()
    return Promise.resolve()
  }

  #isIgnoringChangesTo(attributeName: string): boolean {
    return this.#ignoredAttributes.has(attributeName)
  }

  #showProgressBar(): void {
    this.#progressBar?.show()
  }

  #hideProgressBar(): void {
    this.#progressBar?.hide()
  }

  #showProgressBarAfterDelay(): void {
    this.#progressBarTimeout = window.setTimeout(this.#showProgressBar, this.#progressBarDelay)
  }

  get id(): string {
    return this.element.id
  }

  get enabled(): boolean {
    return !this.element.disabled
  }

  get sourceURL(): string | null {
    if (this.element.src) {
      return this.element.src
    }
    return null
  }
  
  set sourceURL(sourceURL: string | null) {
    this.#ignoredAttributes.add("src")
    this.element.src = sourceURL
    this.#ignoredAttributes.delete("src")
  }

  get loadingStyle(): string {
    return this.element.loading
  }

  get isLoading(): boolean {
    return this.#formSubmission !== undefined || typeof this.#resolveVisitPromise === 'function'
  }

  get complete(): boolean {
    return this.element.hasAttribute("complete")
  }

  set complete(value: boolean) {
    if (value) {
      this.element.setAttribute("complete", "")
    } else {
      this.element.removeAttribute("complete")
    }
  }

  get isActive(): boolean {
    return (this.element as any).isActive && this.#connected
  }

  get rootLocation(): URL {
    const meta = this.element.ownerDocument.querySelector(`meta[name="turbo-root"]`)
    const root = meta?.getAttribute("content") ?? "/"
    return expandURL(root)
  }



  #visitResponse(response: FetchResponse): void {
    const location = response.response.url
    if (location) {
      const requestURL = expandURL(location)
      if (this.enabled && !requestURL.hash) {
        this.#navigateFrameToLocation(requestURL)
      }
    }
  }

  #navigateFrameToLocation(url: URL): void {
    const destinationURL = new URL(url.href)
    this.sourceURL = destinationURL.toString()
  }

  loadingStyleChanged(): void {
    // This method is required by the FrameElementDelegate interface
    // but was not implemented in the original JavaScript code
  }

  proposeVisitIfNavigatedWithAction(element: FrameElement, action: string): void {
    // This method is required by the FrameElementDelegate interface
    // but was not implemented in the original JavaScript code
  }
}
