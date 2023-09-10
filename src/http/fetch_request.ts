import { FetchResponse } from "./fetch_response"
import { FrameElement } from "../elements/frame_element"
import { dispatch } from "../util"

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
  get,
  post,
  put,
  patch,
  delete,
}

export function fetchMethodFromString(method: string) {
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

export class FetchRequest {
  readonly delegate: FetchRequestDelegate
  readonly method: FetchMethod
  readonly headers: FetchRequestHeaders
  readonly url: URL
  readonly body?: FetchRequestBody
  readonly target?: FrameElement | HTMLFormElement | null
  readonly abortController = new AbortController()
  private resolveRequestPromise = (_value: any) => {}

  constructor(
    delegate: FetchRequestDelegate,
    method: FetchMethod,
    location: URL,
    body: FetchRequestBody = new URLSearchParams(),
    target: FrameElement | HTMLFormElement | null = null,
  ) {
    const [url, body] = buildResourceAndBody(expandURL(location), method, requestBody, enctype)

    this.delegate = delegate
    this.url = url
    this.target = target
    this.fetchOptions = {
      credentials: "same-origin",
      redirect: "follow",
      method: method,
      headers: { ...this.defaultHeaders },
      body: body,
      signal: this.abortSignal,
      referrer: this.delegate.referrer?.href,
    }
    this.enctype = enctype
  }

  get method() {
    return this.fetchOptions.method
  }

  set method(value) {
    const fetchBody = this.isSafe ? this.url.searchParams : this.fetchOptions.body || new FormData()
    const fetchMethod = fetchMethodFromString(value) || FetchMethod.get

    this.url.search = ""

    const [url, body] = buildResourceAndBody(this.url, fetchMethod, fetchBody, this.enctype)

    this.url = url
    this.fetchOptions.body = body
    this.fetchOptions.method = fetchMethod
  }

  get headers() {
    return this.fetchOptions.headers
  }

  set headers(value) {
    this.fetchOptions.headers = value
  }

  get body() {
    if (this.isSafe) {
      return this.url.searchParams
    } else {
      return this.fetchOptions.body
    }
  }

  set body(value) {
    this.fetchOptions.body = value
  }

  get location(): URL {
    return this.url
  }

  get params(): URLSearchParams {
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
    await this.allowRequestToBeIntercepted(fetchOptions)
    try {
      this.delegate.requestStarted(this)
      const response = await fetch(this.url.href, fetchOptions)
      return await this.receive(response)
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        if (this.willDelegateErrorHandling(error as Error)) {
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
      detail: { fetchResponse },
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

  get defaultHeaders() {
    return {
      Accept: "text/html, application/xhtml+xml",
    }
  }

  get isSafe() {
    return isSafe(this.method)
  }

  get abortSignal() {
    return this.abortController.signal
  }

  acceptResponseType(mimeType: string) {
    this.headers["Accept"] = [mimeType, this.headers["Accept"]].join(", ")
  }

  private async allowRequestToBeIntercepted(fetchOptions: RequestInit) {
    const requestInterception = new Promise((resolve) => (this.resolveRequestPromise = resolve))
    const event = dispatch<TurboBeforeFetchRequestEvent>("turbo:before-fetch-request", {
      cancelable: true,
      detail: {
        fetchOptions,
        url: this.url,
        resume: this.resolveRequestPromise,
      },
      target: this.target as EventTarget,
    })
    if (event.defaultPrevented) await requestInterception
  }

  private willDelegateErrorHandling(error: Error) {
    const event = dispatch<TurboFetchRequestErrorEvent>("turbo:fetch-request-error", {
      target: this.target as EventTarget,
      cancelable: true,
      detail: { request: this, error: error },
    })

    return !event.defaultPrevented
  }
}

export function isSafe(fetchMethod) {
  return fetchMethodFromString(fetchMethod) == FetchMethod.get
}

function buildResourceAndBody(resource, method, requestBody, enctype) {
  const searchParams =
    Array.from(requestBody).length > 0 ? new URLSearchParams(entriesExcludingFiles(requestBody)) : resource.searchParams

  if (isSafe(method)) {
    return [mergeIntoURLSearchParams(resource, searchParams), null]
  } else if (enctype == FetchEnctype.urlEncoded) {
    return [resource, searchParams]
  } else {
    return [resource, requestBody]
  }
}

function entriesExcludingFiles(requestBody) {
  const entries = [] as [string, string][]

  for (const [name, value] of requestBody) {
    if (value instanceof File) continue
    else entries.push([name, value])
  }

  return entries
}

function mergeIntoURLSearchParams(url, requestBody) {
  const searchParams = new URLSearchParams(entriesExcludingFiles(requestBody))

  url.search = searchParams.toString()

  return url
}
