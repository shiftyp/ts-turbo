import { findLinkFromClickTarget } from "../../util"

export interface LinkInterceptorDelegate {
  shouldInterceptLinkClick(element: Element, url: string, originalEvent: Event): boolean
  linkClickIntercepted(element: HTMLElement, url: URL, event: MouseEvent): void
}

interface TurboClickEvent extends CustomEvent {
  target: Element
  detail: {
    url: string
    originalEvent: Event
  }
}

export class LinkInterceptor {
  private readonly delegate: LinkInterceptorDelegate
  private readonly element: Element
  private clickEvent?: Event

  constructor(delegate: LinkInterceptorDelegate, element: Element) {
    this.delegate = delegate
    this.element = element
  }

  start(): void {
    this.element.addEventListener("click", this.clickBubbled)
    document.addEventListener("turbo:click", this.linkClicked as EventListener)
    document.addEventListener("turbo:before-visit", this.willVisit)
  }

  stop(): void {
    this.element.removeEventListener("click", this.clickBubbled)
    document.removeEventListener("turbo:click", this.linkClicked as EventListener)
    document.removeEventListener("turbo:before-visit", this.willVisit)
  }

  private clickBubbled = (event: Event): void => {
    if (this.clickEventIsSignificant(event)) {
      this.clickEvent = event
    } else {
      delete this.clickEvent
    }
  }

  private linkClicked = (event: TurboClickEvent): void => {
    if (this.clickEvent && this.clickEventIsSignificant(event)) {
      if (this.delegate.shouldInterceptLinkClick(event.target, event.detail.url, event.detail.originalEvent)) {
        this.clickEvent.preventDefault()
        event.preventDefault()
        this.delegate.linkClickIntercepted(
          event.target as HTMLElement,
          new URL(event.detail.url),
          event.detail.originalEvent as MouseEvent
        )
      }
    }
    delete this.clickEvent
  }

  private willVisit = (_event: Event): void => {
    delete this.clickEvent
  }

  private clickEventIsSignificant(event: Event): boolean {
    const target = event.composed ? (event.target as Element)?.parentElement : event.target
    const element = findLinkFromClickTarget(target as Element) || target

    return element instanceof Element && element.closest("turbo-frame, html") == this.element
  }
}
