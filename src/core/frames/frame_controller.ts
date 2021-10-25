import {
  FrameElement,
  FrameElementDelegate,
  FrameLoadingStyle,
  FrameElementObservedAttribute,
} from "../../elements/frame_element"
import { FetchRequest, TurboFetchRequestErrorEvent } from "../../http/fetch_request"
import { FetchResponse } from "../../http/fetch_response"
import { AppearanceObserver, AppearanceObserverDelegate } from "../../observers/appearance_observer"
import { dispatch, getAttribute, uuid, getHistoryMethodForAction } from "../../util"
import { Snapshot } from "../snapshot"
import { ViewDelegate, ViewRenderOptions } from "../view"
import { Locatable, getAction, expandURL, urlsAreEqual, locationIsVisitable } from "../url"
import { FormSubmitObserver, FormSubmitObserverDelegate } from "../../observers/form_submit_observer"
import { FrameView } from "./frame_view"
import { LinkInterceptor, LinkInterceptorDelegate } from "./link_interceptor"
import { FormLinkClickObserver, FormLinkClickObserverDelegate } from "../../observers/form_link_click_observer"
import { FrameRenderer } from "./frame_renderer"
import { session } from "../index"
import { Action } from "../types"
import { FrameVisit, FrameVisitDelegate, FrameVisitOptions } from "./frame_visit"
import { VisitOptions } from "../drive/visit"
import { TurboBeforeFrameRenderEvent } from "../session"
import { PageSnapshot } from "../drive/page_snapshot"
import { TurboFrameMissingError } from "../errors"

type VisitFallback = (location: Response | Locatable, options: Partial<VisitOptions>) => Promise<void>
export type TurboFrameMissingEvent = CustomEvent<{ response: Response; visit: VisitFallback }>

export class FrameController
  implements
    AppearanceObserverDelegate<FrameElement>,
    FormSubmitObserverDelegate,
    FrameElementDelegate,
    FormLinkClickObserverDelegate,
    FrameVisitDelegate,
    LinkInterceptorDelegate,
    ViewDelegate<FrameElement, Snapshot<FrameElement>>
{
  readonly element: FrameElement
  readonly view: FrameView
  readonly appearanceObserver: AppearanceObserver<FrameElement>
  readonly formLinkClickObserver: FormLinkClickObserver
  readonly linkInterceptor: LinkInterceptor
  readonly formSubmitObserver: FormSubmitObserver
  frameVisit?: FrameVisit
  private connected = false
  private hasBeenLoaded = false
  private ignoredAttributes: Set<FrameElementObservedAttribute> = new Set()
  readonly restorationIdentifier: string
  private previousFrameElement?: FrameElement

  constructor(element: FrameElement) {
    this.element = element
    this.view = new FrameView(this, this.element)
    this.appearanceObserver = new AppearanceObserver(this, this.element)
    this.formLinkClickObserver = new FormLinkClickObserver(this, this.element)
    this.linkInterceptor = new LinkInterceptor(this, this.element)
    this.restorationIdentifier = uuid()
    this.formSubmitObserver = new FormSubmitObserver(this, this.element)
  }

  connect() {
    if (!this.connected) {
      this.connected = true
      if (this.loadingStyle == FrameLoadingStyle.lazy) {
        this.appearanceObserver.start()
      } else {
        this.loadSourceURL()
      }
      this.formLinkClickObserver.start()
      this.linkInterceptor.start()
      this.formSubmitObserver.start()
    }
  }

  disconnect() {
    if (this.connected) {
      this.connected = false
      this.appearanceObserver.stop()
      this.formLinkClickObserver.stop()
      this.linkInterceptor.stop()
      this.formSubmitObserver.stop()
    }
  }

  visit(options: FrameVisitOptions): Promise<void> {
    const frameVisit = new FrameVisit(this, this.element, options)
    return frameVisit.start()
  }

  disabledChanged() {
    if (this.loadingStyle == FrameLoadingStyle.eager) {
      this.loadSourceURL()
    }
  }

  sourceURLChanged() {
    if (this.isIgnoringChangesTo("src")) return

    if (this.element.isConnected) {
      this.complete = false
    }

    if (this.loadingStyle == FrameLoadingStyle.eager || this.hasBeenLoaded) {
      this.loadSourceURL()
    }
  }

  sourceURLReloaded() {
    const { src } = this.element
    this.ignoringChangesToAttribute("complete", () => {
      this.element.removeAttribute("complete")
    })
    this.element.src = null
    this.element.src = src
    return this.element.loaded
  }

  completeChanged() {
    if (this.isIgnoringChangesTo("complete")) return

    this.loadSourceURL()
  }

  loadingStyleChanged() {
    if (this.loadingStyle == FrameLoadingStyle.lazy) {
      this.appearanceObserver.start()
    } else {
      this.appearanceObserver.stop()
      this.loadSourceURL()
    }
  }

  private async loadSourceURL() {
    if (this.enabled && this.isActive && !this.complete && this.sourceURL) {
      await this.visit({ url: this.sourceURL })
    }
  }

  async loadResponse(fetchResponse: FetchResponse, frameVisit: FrameVisit) {
    if (fetchResponse.redirected || (fetchResponse.succeeded && fetchResponse.isHTML)) {
      this.sourceURL = fetchResponse.response.url
    }

    const html = await fetchResponse.responseHTML
    if (html) {
      const pageSnapshot = PageSnapshot.fromHTMLString(html)

      if (pageSnapshot.isVisitable) {
        await this.loadFrameResponse(fetchResponse, pageSnapshot, frameVisit)
      } else {
        await this.handleUnvisitableFrameResponse(fetchResponse)
      }
    }
  }

  // Appearance observer delegate

  elementAppearedInViewport(_element: FrameElement) {
    this.loadSourceURL()
  }

  // Form link click observer delegate

  willSubmitFormLinkToLocation(link: Element): boolean {
    return this.shouldInterceptNavigation(link)
  }

  submittedFormLinkToLocation(link: Element, _location: URL, form: HTMLFormElement): void {
    const frame = this.findFrameElement(link)
    if (frame) form.setAttribute("data-turbo-frame", frame.id)
  }

  // Link interceptor delegate

  shouldInterceptLinkClick(element: Element, _location: string, _event: MouseEvent) {
    return this.shouldInterceptNavigation(element)
  }

  linkClickIntercepted(element: Element, location: string) {
    this.navigateFrame(element, location)
  }

  // Form submit observer delegate

  willSubmitForm(element: HTMLFormElement, submitter?: HTMLElement) {
    return element.closest("turbo-frame") == this.element && this.shouldInterceptNavigation(element, submitter)
  }

  formSubmitted(element: HTMLFormElement, submitter?: HTMLElement) {
    const frame = this.findFrameElement(element, submitter)
    frame.delegate.visit(FrameVisit.optionsForSubmit(element, submitter))
  }

  // Frame visit delegate

  shouldVisit(_frameVisit: FrameVisit) {
    return this.enabled && this.isActive
  }

  visitStarted(frameVisit: FrameVisit) {
    this.ignoringChangesToAttribute("complete", () => {
      this.frameVisit?.stop()
      this.frameVisit = frameVisit
      this.element.removeAttribute("complete")
    })
  }

  async visitSucceededWithResponse(frameVisit: FrameVisit, response: FetchResponse) {
    await this.loadResponse(response, frameVisit)

    if (!frameVisit.isSafe) {
      session.clearCache()
    }
  }

  async visitFailedWithResponse(frameVisit: FrameVisit, response: FetchResponse) {
    await this.loadResponse(response, frameVisit)

    session.clearCache()
  }

  visitErrored(frameVisit: FrameVisit, request: FetchRequest, error: Error) {
    console.error(error)
    dispatch<TurboFetchRequestErrorEvent>("turbo:fetch-request-error", {
      target: this.element,
      detail: { request, error },
    })
  }

  visitCompleted(_frameVisit: FrameVisit) {
    this.hasBeenLoaded = true
  }

  // View delegate

  allowsImmediateRender(
    { element: newFrame }: Snapshot<FrameElement>,
    _isPreview: boolean,
    options: ViewRenderOptions<FrameElement>
  ) {
    const event = dispatch<TurboBeforeFrameRenderEvent>("turbo:before-frame-render", {
      target: this.element,
      detail: { newFrame, ...options },
      cancelable: true,
    })
    const {
      defaultPrevented,
      detail: { render },
    } = event

    if (this.view.renderer && render) {
      this.view.renderer.renderElement = render
    }

    return !defaultPrevented
  }

  viewRenderedSnapshot(_snapshot: Snapshot, _isPreview: boolean) {}

  preloadOnLoadLinksForView(element: Element) {
    session.preloadOnLoadLinksForView(element)
  }

  viewInvalidated() {}

  // Frame renderer delegate
  willRenderFrame(currentElement: FrameElement, _newElement: FrameElement) {
    this.previousFrameElement = currentElement.cloneNode(true)
  }

  visitCachedSnapshot = ({ element }: Snapshot) => {
    const frame = element.querySelector("#" + this.element.id)

    if (frame && this.previousFrameElement) {
      frame.replaceChildren(...this.previousFrameElement.children)
    }

    delete this.previousFrameElement
  }

  // Private

  private async loadFrameResponse(fetchResponse: FetchResponse, pageSnapshot: PageSnapshot, frameVisit: FrameVisit) {
    const newFrameElement = await this.extractForeignFrameElement(pageSnapshot.element)

    if (newFrameElement) {
      const snapshot = new Snapshot(newFrameElement)
      const renderer = new FrameRenderer(this, this.view.snapshot, snapshot, FrameRenderer.renderElement, false, false)
      if (this.view.renderPromise) await this.view.renderPromise
      this.changeHistory(frameVisit.action)

      await this.view.render(renderer)
      this.complete = true
      session.frameRendered(fetchResponse, this.element)
      session.frameLoaded(this.element)
      this.proposeVisitIfNavigatedWithAction(frameVisit, fetchResponse)
    } else if (this.willHandleFrameMissingFromResponse(fetchResponse)) {
      this.handleFrameMissingFromResponse(fetchResponse)
    }
  }

  private navigateFrame(element: Element, url: string) {
    const frame = this.findFrameElement(element)
    frame.delegate.visit(FrameVisit.optionsForClick(element, expandURL(url)))
  }

  private proposeVisitIfNavigatedWithAction({ action, element, snapshot }: FrameVisit, fetchResponse: FetchResponse) {
    if (element.src && action) {
      const { statusCode, redirected } = fetchResponse
      const responseHTML = element.ownerDocument.documentElement.outerHTML
      const options: Partial<VisitOptions> = {
        action,
        snapshot,
        response: { statusCode, redirected, responseHTML },
        restorationIdentifier: this.restorationIdentifier,
        updateHistory: false,
        visitCachedSnapshot: this.visitCachedSnapshot,
        willRender: false,
      }

      session.visit(element.src, options)
    }
  }

  changeHistory(action: Action | null) {
    if (action) {
      const method = getHistoryMethodForAction(action)
      session.history.update(method, expandURL(this.element.src || ""), this.restorationIdentifier)
    }
  }

  private async handleUnvisitableFrameResponse(fetchResponse: FetchResponse) {
    console.warn(
      `The response (${fetchResponse.statusCode}) from <turbo-frame id="${this.element.id}"> is performing a full page visit due to turbo-visit-control.`
    )

    await this.visitResponse(fetchResponse.response)
  }

  private willHandleFrameMissingFromResponse(fetchResponse: FetchResponse): boolean {
    this.element.setAttribute("complete", "")

    const response = fetchResponse.response
    const visit = async (url: Locatable | Response, options: Partial<VisitOptions> = {}) => {
      if (url instanceof Response) {
        this.visitResponse(url)
      } else {
        session.visit(url, options)
      }
    }

    const event = dispatch<TurboFrameMissingEvent>("turbo:frame-missing", {
      target: this.element,
      detail: { response, visit },
      cancelable: true,
    })

    return !event.defaultPrevented
  }

  private handleFrameMissingFromResponse(fetchResponse: FetchResponse) {
    this.view.missing()
    this.throwFrameMissingError(fetchResponse)
  }

  private throwFrameMissingError(fetchResponse: FetchResponse) {
    const message = `The response (${fetchResponse.statusCode}) did not contain the expected <turbo-frame id="${this.element.id}"> and will be ignored. To perform a full page visit instead, set turbo-visit-control to reload.`
    throw new TurboFrameMissingError(message)
  }

  private async visitResponse(response: Response): Promise<void> {
    const wrapped = new FetchResponse(response)
    const responseHTML = await wrapped.responseHTML
    const { location, redirected, statusCode } = wrapped

    return session.visit(location, { response: { redirected, statusCode, responseHTML } })
  }

  private findFrameElement(element: Element, submitter?: HTMLElement) {
    const id = getAttribute("data-turbo-frame", submitter, element) || this.element.getAttribute("target")
    return getFrameElementById(id) ?? this.element
  }

  async extractForeignFrameElement(container: ParentNode): Promise<FrameElement | null> {
    let element
    const id = CSS.escape(this.id)

    try {
      element = activateElement(container.querySelector(`turbo-frame#${id}`), this.sourceURL)
      if (element) {
        return element
      }

      element = activateElement(container.querySelector(`turbo-frame[src][recurse~=${id}]`), this.sourceURL)
      if (element) {
        await element.loaded
        return await this.extractForeignFrameElement(element)
      }
    } catch (error) {
      console.error(error)
      return new FrameElement()
    }

    return null
  }

  private formActionIsVisitable(form: HTMLFormElement, submitter?: HTMLElement) {
    const action = getAction(form, submitter)

    return locationIsVisitable(expandURL(action), this.rootLocation)
  }

  private shouldInterceptNavigation(element: Element, submitter?: HTMLElement) {
    const id = getAttribute("data-turbo-frame", submitter, element) || this.element.getAttribute("target")

    if (element instanceof HTMLFormElement && !this.formActionIsVisitable(element, submitter)) {
      return false
    }

    if (!this.enabled || id == "_top") {
      return false
    }

    if (id) {
      const frameElement = getFrameElementById(id)
      if (frameElement) {
        return !frameElement.disabled
      }
    }

    if (!session.elementIsNavigatable(element)) {
      return false
    }

    if (submitter && !session.elementIsNavigatable(submitter)) {
      return false
    }

    return true
  }

  // Computed properties

  get id() {
    return this.element.id
  }

  get enabled() {
    return !this.element.disabled
  }

  get sourceURL() {
    if (this.element.src) {
      return this.element.src
    }
  }

  set sourceURL(sourceURL: string | undefined) {
    this.ignoringChangesToAttribute("src", () => {
      this.element.src = sourceURL ?? null
    })
  }

  get loadingStyle() {
    return this.element.loading
  }

  get isLoading() {
    return this.frameVisit !== undefined
  }

  get complete() {
    return this.element.hasAttribute("complete")
  }

  set complete(value: boolean) {
    this.ignoringChangesToAttribute("complete", () => {
      if (value) {
        this.element.setAttribute("complete", "")
      } else {
        this.element.removeAttribute("complete")
      }
    })
  }

  get isActive() {
    return this.element.isActive && this.connected
  }

  get rootLocation() {
    const meta = this.element.ownerDocument.querySelector<HTMLMetaElement>(`meta[name="turbo-root"]`)
    const root = meta?.content ?? "/"
    return expandURL(root)
  }

  private isIgnoringChangesTo(attributeName: FrameElementObservedAttribute): boolean {
    return this.ignoredAttributes.has(attributeName)
  }

  private ignoringChangesToAttribute(attributeName: FrameElementObservedAttribute, callback: () => void) {
    this.ignoredAttributes.add(attributeName)
    callback()
    this.ignoredAttributes.delete(attributeName)
  }
}

function getFrameElementById(id: string | null) {
  if (id != null) {
    const element = document.getElementById(id)
    if (element instanceof FrameElement) {
      return element
    }
  }
}

function activateElement(element: Element | null, currentURL?: string | null) {
  if (element) {
    const src = element.getAttribute("src")
    if (src != null && currentURL != null && urlsAreEqual(src, currentURL)) {
      throw new Error(`Matching <turbo-frame id="${element.id}"> element has a source URL which references itself`)
    }
    if (element.ownerDocument !== document) {
      element = document.importNode(element, true)
    }

    if (element instanceof FrameElement) {
      element.connectedCallback()
      element.disconnectedCallback()
      return element
    }
  }
}
