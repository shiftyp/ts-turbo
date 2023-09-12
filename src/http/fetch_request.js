import { FetchResponse } from "./fetch_response"
import { dispatch } from "../util"
import { expandURL } from "../core/url"

export function fetchMethodFromString(method) {
  switch (method.toLowerCase()) {
    case "get":
      return FetchMethod.get
    case "post":
      return FetchMethod.post
    case "put":
      return FetchMethod.put
    case "patch":
      return FetchMethod.patch
    case "delete":
      return FetchMethod.delete
  }
}

export const FetchMethod = {
  get: "get",
  post: "post",
  put: "put",
  patch: "patch",
  delete: "delete"
}

export function isSafe(method) {
  return fetchMethodFromString(method) === FetchMethod.get
}

export class FetchRequest {
  abortController = new AbortController()
  #resolveRequestPromise = (_value) => {}

  constructor(delegate, method, location, body = new URLSearchParams(), target = null) {
    method = fetchMethodFromString(method)

    const url = expandURL(location)

    this.delegate = delegate
    this.target = target
    this.request = new Request(url.href, {
      method,
      body: isSafe(method) ? null : body,
      credentials: "same-origin",
      redirect: "follow",
      referrer: this.delegate.referrer?.href,
      signal: this.abortController.signal,
      headers: this.defaultHeaders
    })
  }

  get method() {
    return this.request.method
  }

  get headers() {
    return this.request.headers
  }

  get body() {
    return this.request.body
  }

  get url() {
    return this.request.url
  }

  get location() {
    return this.url
  }

  get params() {
    return this.url.searchParams
  }

  get entries() {
    return this.body ? Array.from(this.body.entries()) : []
  }

  cancel() {
    this.abortController.abort()
  }

  async perform() {
    const { fetchOptions } = this
    this.delegate.prepareRequest(this)
    await this.#allowRequestToBeIntercepted(fetchOptions)
    try {
      this.delegate.requestStarted(this)
      const response = await fetch(this.request)
      return await this.receive(response)
    } catch (error) {
      if (error.name !== "AbortError") {
        if (this.#willDelegateErrorHandling(error)) {
          this.delegate.requestErrored(this, error)
        }
        throw error
      }
    } finally {
      this.delegate.requestFinished(this)
    }
  }

  async receive(response) {
    const fetchResponse = new FetchResponse(response)
    const event = dispatch("turbo:before-fetch-response", {
      cancelable: true,
      detail: {
        get fetchResponse() {
          console.warn("`event.detail.fetchResponse` is deprecated. Use `event.detail.response` instead")

          return fetchResponse
        },
        response
      },
      target: this.target
    })
    if (event.defaultPrevented) {
      this.delegate.requestPreventedHandlingResponse(this, fetchResponse)
    } else if (fetchResponse.succeeded) {
      this.delegate.requestSucceededWithResponse(this, fetchResponse)
    } else {
      this.delegate.requestFailedWithResponse(this, fetchResponse)
    }
    return fetchResponse
  }

  get fetchOptions() {
    return {
      method: this.method,
      credentials: "same-origin",
      headers: Object.fromEntries(this.headers.entries()),
      redirect: "follow",
      body: this.isSafe ? null : this.body,
      signal: this.abortSignal,
      referrer: this.delegate.referrer?.href
    }
  }

  get defaultHeaders() {
    return {
      Accept: "text/html, application/xhtml+xml"
    }
  }

  get isSafe() {
    return isSafe(this.method)
  }

  get abortSignal() {
    return this.request.signal
  }

  acceptResponseType(mimeType) {
    this.headers.set("Accept", [mimeType, this.headers.get("Accept")].join(", "))
  }

  async #allowRequestToBeIntercepted(fetchOptions) {
    const { request } = this
    const requestInterception = new Promise((resolve) => (this.#resolveRequestPromise = resolve))
    const event = dispatch("turbo:before-fetch-request", {
      cancelable: true,
      detail: {
        get fetchOptions() {
          console.warn("`event.detail.fetchOptions` is deprecated. Use `event.detail.request` instead")

          return fetchOptions
        },

        get url() {
          console.warn("`event.detail.url` is deprecated. Use `event.detail.request.url` instead")

          return request.url
        },

        request: this.request,
        resume: this.#resolveRequestPromise
      },
      target: this.target
    })
    if (event.defaultPrevented) await requestInterception
  }

  #willDelegateErrorHandling(error) {
    const event = dispatch("turbo:fetch-request-error", {
      target: this.target,
      cancelable: true,
      detail: { request: this.request, error: error }
    })

    return !event.defaultPrevented
  }
}
