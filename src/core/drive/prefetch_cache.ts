import { FetchRequest } from "../../http/fetch_request"

const PREFETCH_DELAY = 100

interface PrefetchedRequest {
  url: string
  request: FetchRequest
  expire: Date
}

class PrefetchCache {
  #prefetchTimeout: number | null = null
  #prefetched: PrefetchedRequest | null = null

  get(url: string): FetchRequest | undefined {
    if (this.#prefetched && this.#prefetched.url === url && this.#prefetched.expire > new Date()) {
      return this.#prefetched.request
    }
  }

  setLater(url: string, request: FetchRequest, ttl: number): void {
    this.clear()

    this.#prefetchTimeout = window.setTimeout(() => {
      request.perform()
      this.set(url, request, ttl)
      this.#prefetchTimeout = null
    }, PREFETCH_DELAY)
  }

  set(url: string, request: FetchRequest, ttl: number): void {
    this.#prefetched = { url, request, expire: new Date(new Date().getTime() + ttl) }
  }

  clear(): void {
    if (this.#prefetchTimeout) clearTimeout(this.#prefetchTimeout)
    this.#prefetched = null
  }
}

export const cacheTtl = 10 * 1000
export const prefetchCache = new PrefetchCache()
