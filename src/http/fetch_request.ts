import { FetchResponse } from "./fetch_response"
import { FrameElement } from "../elements/frame_element"
import { dispatch } from "../util"
import { expandURL } from "../core/url"

export type TurboBeforeFetchRequestEvent = CustomEvent<{
  fetchOptions: RequestInit
  url: URL
  resume: (value?: any) => void
}>
export type TurboBeforeFetchResponseEvent = CustomEvent<{
  fetchResponse: FetchResponse
}>
export type TurboFetchRequestErrorEvent = CustomEvent<{
  request: FetchRequest
  error: Error
}>

export interface FetchRequestDelegate {
  referrer?: URL

  prepareRequest(request: FetchRequest): void
  requestStarted(request: FetchRequest): void
  requestPreventedHandlingResponse(request: FetchRequest, response: FetchResponse): void
  requestSucceededWithResponse(request: FetchRequest, response: FetchResponse): void
  requestFailedWithResponse(request: FetchRequest, response: FetchResponse): void
  requestErrored(request: FetchRequest, error: Error): void
  requestFinished(request: FetchRequest): void
}

export enum FetchMethod {
  get = "get",
  post = "post",
  put = "put",
  patch = "patch",
  delete = "delete",
}

export function fetchMethodFromString(method: FetchMethod) {
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

export function fetchEnctypeFromString(encoding: string) {
  switch (encoding.toLowerCase()) {
    case FetchEnctype.multipart:
      return FetchEnctype.multipart
    case FetchEnctype.plain:
      return FetchEnctype.plain
    default:
      return FetchEnctype.urlEncoded
  }
}

export const FetchEnctype = {
  urlEncoded: "application/x-www-form-urlencoded",
  multipart: "multipart/form-data",
  plain: "text/plain",
}

export type FetchRequestBody = FormData | URLSearchParams

export type FetchRequestHeaders = { [header: string]: string }

export interface FetchRequestOptions {
  headers: FetchRequestHeaders
  body: FetchRequestBody
  followRedirects: boolean
}

export function isSafe(method: FetchMethod | string) {
  return fetchMethodFromString(method) === FetchMethod.get
}

export function isSafe(method) {
  return fetchMethodFromString(method) === FetchMethod.get
}

export class FetchRequest {
  readonly delegate: FetchRequestDelegate
  request: Request
  readonly target?: FrameElement | HTMLFormElement | null
  readonly abortController = new AbortController()
  private resolveRequestPromise = (_value: any) => {}
  fetchOptions: FetchRequestOptions
  enctype: string
  #resolveRequestPromise = (_value: unknown) => {}

  constructor(
    delegate: FetchRequestDelegate,
    method: FetchMethod,
    location: URL,
    requestBody: FetchRequestBody = new URLSearchParams(),
    target: FrameElement | HTMLFormElement | null = null,
    enctype = FetchEnctype.urlEncoded,
  ) {
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
      headers: this.defaultHeaders,
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

  async perform(): Promise<FetchResponse | void> {
    const { fetchOptions } = this
    this.delegate.prepareRequest(this)
    await this.#allowRequestToBeIntercepted(fetchOptions)
    try {
      this.delegate.requestStarted(this)
      const response = await fetch(this.request)
      return await this.receive(response)
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        if (this.#willDelegateErrorHandling(error as Error)) {
          this.delegate.requestErrored(this, error as Error)
        }
        throw error
      }
    } finally {
      this.delegate.requestFinished(this)
    }
  }

  async receive(response: Response): Promise<FetchResponse> {
    const fetchResponse = new FetchResponse(response)
    const event = dispatch<TurboBeforeFetchResponseEvent>("turbo:before-fetch-response", {
      cancelable: true,
      detail: {
        get fetchResponse() {
          console.warn("`event.detail.fetchResponse` is deprecated. Use `event.detail.response` instead")

          return fetchResponse
        },
        response,
      },
      target: this.target as EventTarget,
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

  get fetchOptions(): RequestInit {
    return {
      method: this.method,
      credentials: "same-origin",
      headers: Object.fromEntries(this.headers.entries()),
      redirect: "follow",
      body: this.isSafe ? null : this.body,
      signal: this.abortSignal,
      referrer: this.delegate.referrer?.href,
    }
  }

  get defaultHeaders() {
    return {
      Accept: "text/html, application/xhtml+xml",
    }
  }

  get isSafe() {
    return isSafe(this.method)
  }

  get abortSignal() {
    return this.request.signal
  }

  acceptResponseType(mimeType: string) {
    this.headers.set("Accept", [mimeType, this.headers.get("Accept")].join(", "))
  }

  async #allowRequestToBeIntercepted(fetchOptions: RequestInit) {
    const { request } = this
    const requestInterception = new Promise((resolve) => (this.resolveRequestPromise = resolve))
    const event = dispatch<TurboBeforeFetchRequestEvent>("turbo:before-fetch-request", {
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
        resume: this.resolveRequestPromise,
      },
      target: this.target as EventTarget,
    })
    if (event.defaultPrevented) await requestInterception
  }

  #willDelegateErrorHandling(error: Error) {
    const event = dispatch<TurboFetchRequestErrorEvent>("turbo:fetch-request-error", {
      target: this.target as EventTarget,
      cancelable: true,
      detail: { request: this.request, error: error },
    })

    return !event.defaultPrevented
  }
}

export function isSafe(fetchMethod: FetchMethod) {
  return fetchMethodFromString(fetchMethod) == FetchMethod.get
}

function buildResourceAndBody(resource: URL, method: FetchMethod, requestBody: FetchRequestBody, enctype: string) {
  const searchParams =
    Array.from(requestBody).length > 0 ? new URLSearchParams(entriesExcludingFiles(requestBody)) : resource.searchParams

  if (isSafe(method)) {
    return [mergeIntoURLSearchParams(resource, searchParams), null] as const
  } else if (enctype == FetchEnctype.urlEncoded) {
    return [resource, searchParams] as const
  } else {
    return [resource, requestBody] as const
  }
}

function entriesExcludingFiles(requestBody: FetchRequestBody) {
  const entries = [] as [string, string][]

  for (const [name, value] of requestBody) {
    if (value instanceof File) continue
    else entries.push([name, value])
  }

  return entries
}

function mergeIntoURLSearchParams(url: URL, requestBody: FetchRequestBody) {
  const searchParams = new URLSearchParams(entriesExcludingFiles(requestBody))

  url.search = searchParams.toString()

  return url
}
