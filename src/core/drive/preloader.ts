import { PageSnapshot } from "./page_snapshot"
import { FetchMethod, FetchRequest } from "../../http/fetch_request"
import { FetchResponse } from "../../http/fetch_response"

export interface PreloaderDelegate {
  shouldPreloadLink(link: HTMLAnchorElement): boolean
}

export interface SnapshotCache {
  has(location: URL): boolean
  put(url: URL, snapshot: PageSnapshot): void
}

export class Preloader {
  readonly selector = "a[data-turbo-preload]"
  readonly delegate: PreloaderDelegate
  readonly snapshotCache: SnapshotCache

  constructor(delegate: PreloaderDelegate, snapshotCache: SnapshotCache) {
    this.delegate = delegate
    this.snapshotCache = snapshotCache
  }

  start(): void {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.#preloadAll)
    } else {
      this.preloadOnLoadLinksForView(document.body)
    }
  }

  stop(): void {
    document.removeEventListener("DOMContentLoaded", this.#preloadAll)
  }

  preloadOnLoadLinksForView(element: Element): void {
    for (const link of element.querySelectorAll<HTMLAnchorElement>(this.selector)) {
      if (this.delegate.shouldPreloadLink(link)) {
        this.preloadURL(link)
      }
    }
  }

  async preloadURL(link: HTMLAnchorElement): Promise<void> {
    const location = new URL(link.href)

    if (this.snapshotCache.has(location)) {
      return
    }

    const fetchRequest = new FetchRequest(this, FetchMethod.get, location, new URLSearchParams(), link)
    await fetchRequest.perform()
  }

  // Fetch request delegate

  prepareRequest(fetchRequest: FetchRequest): void {
    // Use the set method instead of direct property access on headers
    fetchRequest.headers.set("X-Sec-Purpose", "prefetch")
  }

  async requestSucceededWithResponse(fetchRequest: FetchRequest, fetchResponse: FetchResponse): Promise<void> {
    try {
      const responseHTML = await fetchResponse.responseHTML
      if (responseHTML) {
        const snapshot = PageSnapshot.fromHTMLString(responseHTML)
        this.snapshotCache.put(fetchRequest.url, snapshot)
      }
    } catch (_) {
      // If we cannot preload that is ok!
    }
  }

  requestStarted(_fetchRequest: FetchRequest): void {}

  requestErrored(_fetchRequest: FetchRequest): void {}

  requestFinished(_fetchRequest: FetchRequest): void {}

  requestPreventedHandlingResponse(_fetchRequest: FetchRequest, _fetchResponse: FetchResponse): void {}

  // Return a Promise<void> to match the FetchRequestDelegate interface
  async requestFailedWithResponse(_fetchRequest: FetchRequest, _fetchResponse: FetchResponse): Promise<void> {}

  #preloadAll = (): void => {
    this.preloadOnLoadLinksForView(document.body)
  }
}
