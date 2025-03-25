import { LinkClickObserver } from "./link_click_observer"
import { getVisitAction } from "../util"

export interface FormLinkClickDelegate {
  willSubmitFormLinkToLocation(link: HTMLAnchorElement, location: URL, event: MouseEvent): boolean
  submittedFormLinkToLocation(link: HTMLAnchorElement, location: URL, form: HTMLFormElement): void
}

export class FormLinkClickObserver {
  readonly delegate: FormLinkClickDelegate
  readonly linkInterceptor: LinkClickObserver

  constructor(delegate: FormLinkClickDelegate, element: Document | HTMLElement) {
    this.delegate = delegate
    this.linkInterceptor = new LinkClickObserver(this, element)
  }

  start(): void {
    this.linkInterceptor.start()
  }

  stop(): void {
    this.linkInterceptor.stop()
  }

  // Link hover observer delegate
  canPrefetchRequestToLocation(link: HTMLAnchorElement, location: URL): boolean {
    return false
  }

  prefetchAndCacheRequestToLocation(link: HTMLAnchorElement, location: URL): void {
    return
  }

  // Link click observer delegate
  willFollowLinkToLocation(link: HTMLAnchorElement, location: URL, originalEvent: MouseEvent): boolean {
    return (
      this.delegate.willSubmitFormLinkToLocation(link, location, originalEvent) &&
      (link.hasAttribute("data-turbo-method") || link.hasAttribute("data-turbo-stream"))
    )
  }

  followedLinkToLocation(link: HTMLAnchorElement, location: URL): void {
    const form = document.createElement("form")

    const type = "hidden"
    for (const [name, value] of location.searchParams) {
      const input = document.createElement("input")
      Object.assign(input, { type, name, value })
      form.appendChild(input)
    }

    const action = Object.assign(new URL(location.href), { search: "" })
    form.setAttribute("data-turbo", "true")
    form.setAttribute("action", action.href)
    form.setAttribute("hidden", "")

    const method = link.getAttribute("data-turbo-method")
    if (method) form.setAttribute("method", method)

    const turboFrame = link.getAttribute("data-turbo-frame")
    if (turboFrame) form.setAttribute("data-turbo-frame", turboFrame)

    const turboAction = getVisitAction(link)
    if (turboAction) form.setAttribute("data-turbo-action", turboAction)

    const turboConfirm = link.getAttribute("data-turbo-confirm")
    if (turboConfirm) form.setAttribute("data-turbo-confirm", turboConfirm)

    const turboStream = link.hasAttribute("data-turbo-stream")
    if (turboStream) form.setAttribute("data-turbo-stream", "")

    this.delegate.submittedFormLinkToLocation(link, location, form)

    document.body.appendChild(form)
    form.addEventListener("turbo:submit-end", () => form.remove(), { once: true })
    requestAnimationFrame(() => form.requestSubmit())
  }
}
