import { FormSubmitObserver } from "../../observers/form_submit_observer"
import { FrameElement } from "../../elements/frame_element"
import { LinkInterceptor } from "./link_interceptor"
import { expandURL, getAction, locationIsVisitable } from "../url"

export interface FrameRedirectorSession {
  submissionIsNavigatable(element: HTMLFormElement, submitter: HTMLElement | null): boolean
  elementIsNavigatable(element: HTMLElement): boolean
}

export class FrameRedirector {
  readonly session: FrameRedirectorSession
  readonly element: HTMLElement
  readonly linkInterceptor: LinkInterceptor
  readonly formSubmitObserver: FormSubmitObserver

  constructor(session: FrameRedirectorSession, element: HTMLElement) {
    this.session = session
    this.element = element
    this.linkInterceptor = new LinkInterceptor(this, element)
    this.formSubmitObserver = new FormSubmitObserver(this, element)
  }

  start(): void {
    this.linkInterceptor.start()
    this.formSubmitObserver.start()
  }

  stop(): void {
    this.linkInterceptor.stop()
    this.formSubmitObserver.stop()
  }

  // Link interceptor delegate

  shouldInterceptLinkClick(element: Element, url: string, event: Event): boolean {
    return this.#shouldRedirect(element as HTMLElement)
  }

  linkClickIntercepted(element: HTMLElement, url: URL, event: MouseEvent): void {
    const frame = this.#findFrameElement(element)
    if (frame) {
      frame.delegate.linkClickIntercepted(element, url, event)
    }
  }

  // Form submit observer delegate

  willSubmitForm(element: HTMLFormElement, submitter?: HTMLElement): boolean {
    return (
      element.closest("turbo-frame") == null &&
      this.#shouldSubmit(element, submitter) &&
      this.#shouldRedirect(element, submitter)
    )
  }

  formSubmitted(element: HTMLFormElement, submitter?: HTMLElement): void {
    const frame = this.#findFrameElement(element, submitter)
    if (frame) {
      frame.delegate.formSubmitted(element, submitter)
    }
  }

  #shouldSubmit(form: HTMLFormElement, submitter?: HTMLElement): boolean {
    const action = getAction(form, submitter || null)
    const meta = this.element.ownerDocument.querySelector(`meta[name="turbo-root"]`) as HTMLMetaElement
    const rootLocation = expandURL(meta?.content ?? "/")

    return this.#shouldRedirect(form, submitter) && locationIsVisitable(action, rootLocation)
  }

  #shouldRedirect(element: HTMLElement, submitter?: HTMLElement): boolean {
    const isNavigatable =
      element instanceof HTMLFormElement
        ? this.session.submissionIsNavigatable(element, submitter || null)
        : this.session.elementIsNavigatable(element)

    if (isNavigatable) {
      const frame = this.#findFrameElement(element, submitter)
      return frame ? frame != element.closest("turbo-frame") : false
    } else {
      return false
    }
  }

  #findFrameElement(element: HTMLElement, submitter: HTMLElement | null = null): FrameElement | undefined {
    const id = submitter?.getAttribute("data-turbo-frame") || element.getAttribute("data-turbo-frame")
    if (id && id != "_top") {
      const frame = this.element.querySelector(`#${id}:not([disabled])`)
      if (frame instanceof FrameElement) {
        return frame
      }
    }
  }
}
