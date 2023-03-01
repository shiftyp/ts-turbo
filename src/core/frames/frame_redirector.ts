import { HTMLFormSubmission } from "../drive/html_form_submission"
import { FormSubmitObserver, FormSubmitObserverDelegate } from "../../observers/form_submit_observer"
import { FrameElement } from "../../elements/frame_element"
import { LinkInterceptor, LinkInterceptorDelegate } from "./link_interceptor"
import { expandURL, locationIsVisitable } from "../url"
import { Session } from "../session"
export class FrameRedirector implements LinkInterceptorDelegate, FormSubmitObserverDelegate {
  readonly session: Session
  readonly element: Element
  readonly linkInterceptor: LinkInterceptor
  readonly formSubmitObserver: FormSubmitObserver

  constructor(session: Session, element: Element) {
    this.session = session
    this.element = element
    this.linkInterceptor = new LinkInterceptor(this, element)
    this.formSubmitObserver = new FormSubmitObserver(this, element)
  }

  start() {
    this.linkInterceptor.start()
    this.formSubmitObserver.start()
  }

  stop() {
    this.linkInterceptor.stop()
    this.formSubmitObserver.stop()
  }

  shouldInterceptLinkClick(element: Element, _location: string, _event: MouseEvent) {
    return this.shouldRedirect(element)
  }

  linkClickIntercepted(element: Element, url: string, event: MouseEvent) {
    const frame = this.findFrameElement(element)
    if (frame) {
      frame.delegate.linkClickIntercepted(element, url, event)
    }
  }

  willSubmitForm(submission: HTMLFormSubmission) {
    return (
      submission.closest<FrameElement>("turbo-frame") == null &&
      this.shouldSubmit(submission) &&
      this.shouldRedirect(submission)
    )
  }

  formSubmitted(submission: HTMLFormSubmission) {
    const frame = this.findFrameElement(submission)
    if (frame) {
      frame.delegate.formSubmitted(submission)
    }
  }

  private shouldSubmit(submission: HTMLFormSubmission) {
    const meta = this.element.ownerDocument.querySelector<HTMLMetaElement>(`meta[name="turbo-root"]`)
    const rootLocation = expandURL(meta?.content ?? "/")

    return this.shouldRedirect(submission) && locationIsVisitable(submission.location, rootLocation)
  }

  private shouldRedirect(elementOrSubmission: Element | HTMLFormSubmission) {
    const isNavigatable =
      elementOrSubmission instanceof Element
        ? this.session.elementIsNavigatable(elementOrSubmission)
        : this.session.submissionIsNavigatable(elementOrSubmission)

    if (isNavigatable) {
      const frame = this.findFrameElement(elementOrSubmission)
      return frame ? frame != elementOrSubmission.closest<FrameElement>("turbo-frame") : false
    } else {
      return false
    }
  }

  private findFrameElement(elementOrSubmission: Element | HTMLFormSubmission) {
    const id =
      elementOrSubmission instanceof Element
        ? elementOrSubmission.getAttribute("data-turbo-frame")
        : elementOrSubmission.frame

    if (id && id != "_top") {
      const frame = this.element.querySelector(`#${id}:not([disabled])`)
      if (frame instanceof FrameElement) {
        return frame
      }
    }
  }
}
