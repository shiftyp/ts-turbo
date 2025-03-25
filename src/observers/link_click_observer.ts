import { doesNotTargetIFrame, findLinkFromClickTarget, getLocationForLink } from "../util"

export interface LinkClickDelegate {
  willFollowLinkToLocation(link: HTMLAnchorElement, location: URL, event: MouseEvent): boolean
  followedLinkToLocation(link: HTMLAnchorElement, location: URL): void
}

export class LinkClickObserver {
  started = false
  readonly delegate: LinkClickDelegate
  readonly eventTarget: Document | HTMLElement

  constructor(delegate: LinkClickDelegate, eventTarget: Document | HTMLElement) {
    this.delegate = delegate
    this.eventTarget = eventTarget
  }

  start(): void {
    if (!this.started) {
      this.eventTarget.addEventListener("click", this.clickCaptured, true)
      this.started = true
    }
  }

  stop(): void {
    if (this.started) {
      this.eventTarget.removeEventListener("click", this.clickCaptured, true)
      this.started = false
    }
  }

  clickCaptured = (): void => {
    this.eventTarget.removeEventListener("click", this.clickBubbled, false)
    this.eventTarget.addEventListener("click", this.clickBubbled, false)
  }

  clickBubbled = (event: Event): void => {
    if (event instanceof MouseEvent && this.clickEventIsSignificant(event)) {
      const target = (event.composedPath && event.composedPath()[0]) || event.target
      const link = findLinkFromClickTarget(target)
      if (link && doesNotTargetIFrame(link.target)) {
        const location = getLocationForLink(link)
        if (this.delegate.willFollowLinkToLocation(link, location, event)) {
          event.preventDefault()
          this.delegate.followedLinkToLocation(link, location)
        }
      }
    }
  }

  private clickEventIsSignificant(event: MouseEvent): boolean {
    return !(
      (event.target instanceof HTMLElement && event.target.isContentEditable) ||
      event.defaultPrevented ||
      event.button > 0 || // Use button instead of which for better cross-browser support
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
  }
}
