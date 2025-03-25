import {
  dispatch,
  getLocationForLink,
  getMetaContent,
  findClosestRecursively
} from "../util"

import { FetchMethod, FetchRequest } from "../http/fetch_request"
import { prefetchCache, cacheTtl } from "../core/drive/prefetch_cache"

export interface LinkPrefetchDelegate {
  canPrefetchRequestToLocation(link: HTMLAnchorElement, location: URL): boolean
}

export class LinkPrefetchObserver {
  started = false
  #prefetchedLink: HTMLAnchorElement | null = null
  readonly delegate: LinkPrefetchDelegate
  readonly eventTarget: Document | HTMLElement

  constructor(delegate: LinkPrefetchDelegate, eventTarget: Document | HTMLElement) {
    this.delegate = delegate
    this.eventTarget = eventTarget
  }

  start(): void {
    if (this.started) return

    if ((this.eventTarget as Document).readyState === "loading") {
      this.eventTarget.addEventListener("DOMContentLoaded", this.#enable, { once: true })
    } else {
      this.#enable()
    }
  }

  stop(): void {
    if (!this.started) return

    this.eventTarget.removeEventListener("mouseenter", this.#tryToPrefetchRequest as EventListener, {
      capture: true
    })
    this.eventTarget.removeEventListener("mouseleave", this.#cancelRequestIfObsolete as EventListener, {
      capture: true
    })

    this.eventTarget.removeEventListener("turbo:before-fetch-request", this.#tryToUsePrefetchedRequest as EventListener, true)
    this.started = false
  }

  #enable = (): void => {
    this.eventTarget.addEventListener("mouseenter", this.#tryToPrefetchRequest as EventListener, {
      capture: true
    })
    this.eventTarget.addEventListener("mouseleave", this.#cancelRequestIfObsolete as EventListener, {
      capture: true
    })

    this.eventTarget.addEventListener("turbo:before-fetch-request", this.#tryToUsePrefetchedRequest as EventListener, true)
    this.started = true
  }

  #tryToPrefetchRequest = (event: MouseEvent): void => {
    if (getMetaContent("turbo-prefetch") === "false") return

    const target = event.target as Element
    const isLink = target.matches && target.matches("a[href]:not([target^=_]):not([download])")

    if (isLink && this.#isPrefetchable(target as HTMLAnchorElement)) {
      const link = target as HTMLAnchorElement
      const location = getLocationForLink(link)

      if (location && this.delegate.canPrefetchRequestToLocation(link, location)) {
        this.#prefetchedLink = link

        const fetchRequest = new FetchRequest(
          this,
          FetchMethod.get,
          location,
          new URLSearchParams(),
          target as HTMLElement
        )

        const locationString = location?.toString()
        if (locationString) {
          prefetchCache.setLater(locationString, fetchRequest, this.#cacheTtl)
        }
      }
    }
  }

  #cancelRequestIfObsolete = (event: MouseEvent): void => {
    if (event.target === this.#prefetchedLink) this.#cancelPrefetchRequest()
  }

  #cancelPrefetchRequest = (): void => {
    prefetchCache.clear()
    this.#prefetchedLink = null
  }

  #tryToUsePrefetchedRequest = (event: CustomEvent): void => {
    if (event.target instanceof HTMLElement && event.target.tagName !== "FORM" && 
        event.detail?.fetchOptions?.method === "GET" && event.detail?.url) {
      const urlString = event.detail.url.toString()
      if (urlString) {
        const cached = prefetchCache.get(urlString)

        if (cached) {
          // User clicked link, use cache response
          event.detail.fetchRequest = cached
        }
      }

      prefetchCache.clear()
    }
  }

  prepareRequest(request: FetchRequest): void {
    const link = request.target as HTMLAnchorElement

    request.headers.set("X-Sec-Purpose", "prefetch")

    const turboFrame = link.closest("turbo-frame")
    const turboFrameTarget = link.getAttribute("data-turbo-frame") || turboFrame?.getAttribute("target") || turboFrame?.id

    if (turboFrameTarget && turboFrameTarget !== "_top") {
      request.headers.set("Turbo-Frame", turboFrameTarget)
    }
  }

  // Fetch request interface
  requestSucceededWithResponse(): Promise<void> { return Promise.resolve() }
  requestStarted(fetchRequest: FetchRequest): void {}
  requestErrored(fetchRequest: FetchRequest): void {}
  requestFinished(fetchRequest: FetchRequest): void {}
  requestPreventedHandlingResponse(fetchRequest: FetchRequest, fetchResponse: any): Promise<void> { return Promise.resolve() }
  requestFailedWithResponse(fetchRequest: FetchRequest, fetchResponse: any): Promise<void> { return Promise.resolve() }

  get #cacheTtl(): number {
    return Number(getMetaContent("turbo-prefetch-cache-time")) || cacheTtl
  }

  #isPrefetchable(link: HTMLAnchorElement): boolean {
    const href = link.getAttribute("href")

    if (!href) return false

    if (unfetchableLink(link)) return false
    if (linkToTheSamePage(link)) return false
    if (linkOptsOut(link)) return false
    if (nonSafeLink(link)) return false
    if (eventPrevented(link)) return false

    return true
  }
}

const unfetchableLink = (link: HTMLAnchorElement): boolean => {
  return link.origin !== document.location.origin || !["http:", "https:"].includes(link.protocol) || link.hasAttribute("target")
}

const linkToTheSamePage = (link: HTMLAnchorElement): boolean => {
  return (link.pathname + link.search === document.location.pathname + document.location.search) || link.href.startsWith("#")
}

const linkOptsOut = (link: HTMLAnchorElement): boolean => {
  if (link.getAttribute("data-turbo-prefetch") === "false") return true
  if (link.getAttribute("data-turbo") === "false") return true

  const turboPrefetchParent = findClosestRecursively(link, "[data-turbo-prefetch]")
  if (turboPrefetchParent && turboPrefetchParent.getAttribute("data-turbo-prefetch") === "false") return true

  return false
}

const nonSafeLink = (link: HTMLAnchorElement): boolean => {
  const turboMethod = link.getAttribute("data-turbo-method")
  if (turboMethod && turboMethod.toLowerCase() !== "get") return true

  if (isUJS(link)) return true
  if (link.hasAttribute("data-turbo-confirm")) return true
  if (link.hasAttribute("data-turbo-stream")) return true

  return false
}

const isUJS = (link: HTMLAnchorElement): boolean => {
  return link.hasAttribute("data-remote") || link.hasAttribute("data-behavior") || link.hasAttribute("data-confirm") || link.hasAttribute("data-method")
}

const eventPrevented = (link: HTMLAnchorElement): boolean => {
  const event = dispatch("turbo:before-prefetch", { target: link, cancelable: true })
  return event.defaultPrevented
}
