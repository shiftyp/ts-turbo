import { FetchResponse } from "./fetch_response"
import { expandURL } from "../core/url"
import { dispatch } from "../util"
import { fetch } from "./fetch"

export type FetchMethodType = typeof FetchMethod[keyof typeof FetchMethod]
export type FetchEnctypeType = typeof FetchEnctype[keyof typeof FetchEnctype]

export function fetchMethodFromString(method: string): FetchMethodType | undefined {
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
} as const

export function fetchEnctypeFromString(encoding: string): FetchEnctypeType {
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
  plain: "text/plain"
} as const

export interface FetchRequestDelegate {
  referrer?: URL
  prepareRequest?(request: FetchRequest): void
  requestStarted?(request: FetchRequest): void
  requestPreventedHandlingResponse?(request: FetchRequest, response: FetchResponse): void
  requestSucceededWithResponse?(request: FetchRequest, response: FetchResponse): Promise<void>
  requestFailedWithResponse?(request: FetchRequest, response: FetchResponse): Promise<void>
  requestErrored?(request: FetchRequest, error: Error): void
  requestFinished?(request: FetchRequest): void
}

export class FetchRequest {
  readonly delegate: FetchRequestDelegate
  #url: URL
  readonly target: HTMLElement | null
  readonly abortController: AbortController = new AbortController()
  readonly enctype: FetchEnctypeType
  fetchOptions: RequestInit

  #resolveRequestPromise = (_value: any) => {}

  constructor(
    delegate: FetchRequestDelegate,
    method: FetchMethodType,
    location: string | URL,
    requestBody: URLSearchParams | FormData = new URLSearchParams(),
    target: HTMLElement | null = null,
    enctype: FetchEnctypeType = FetchEnctype.urlEncoded
  ) {
    const [url, body] = buildResourceAndBody(expandURL(location), method, requestBody, enctype)

    this.delegate = delegate
    this.#url = url
    this.target = target
    this.fetchOptions = {
      credentials: "same-origin",
      redirect: "follow",
      method: method.toUpperCase(),
      headers: { ...this.defaultHeaders },
      body: body,
      signal: this.abortSignal,
      referrer: this.delegate.referrer?.href
    }
    this.enctype = enctype
  }

  get method(): string {
    return this.fetchOptions.method!
  }

  set method(value: string) {
    const fetchBody = this.isSafe ? this.#url.searchParams : this.fetchOptions.body || new FormData()
    const fetchMethod = fetchMethodFromString(value) || FetchMethod.get

    this.#url.search = ""

    const [newUrl, body] = buildResourceAndBody(this.#url, fetchMethod, fetchBody as URLSearchParams | FormData, this.enctype)

    this.#url = newUrl
    this.fetchOptions.body = body
    this.fetchOptions.method = fetchMethod.toUpperCase()
  }

  get headers(): Headers {
    return this.fetchOptions.headers as Headers
  }

  set headers(value: Headers) {
    this.fetchOptions.headers = value
  }

  get body(): URLSearchParams | FormData {
    if (this.isSafe) {
      return this.url.searchParams
    } else {
      return this.fetchOptions.body as FormData
    }
  }

  set body(value: URLSearchParams | FormData) {
    this.fetchOptions.body = value
  }

  get location(): URL {
    return this.#url
  }

  get url(): URL {
    return this.#url
  }

  get params(): URLSearchParams {
    return this.#url.searchParams
  }

  get entries(): [string, FormDataEntryValue][] {
    if (this.body instanceof FormData) {
      return Array.from(this.body.entries())
    } else {
      return Array.from(this.body.entries()).map(([name, value]) => [name, value] as [string, FormDataEntryValue])
    }
  }

  cancel(): void {
    this.abortController.abort()
  }

  async perform(): Promise<FetchResponse> {
    const { fetchOptions } = this
    this.delegate.prepareRequest?.(this)

    await dispatch("turbo:before-fetch-request", {
      detail: { fetchOptions }
    })

    try {
      this.delegate.requestStarted?.(this)

      const response = new FetchResponse(await fetch(this.url.href, fetchOptions))

      await this.#requestSucceeded(response)
      return response
    } catch (error) {
      await this.#requestErrored(error as Error)
      throw error
    } finally {
      this.delegate.requestFinished?.(this)
    }
  }

  async #requestSucceeded(response: FetchResponse): Promise<void> {
    if (response.succeeded) {
      await this.delegate.requestSucceededWithResponse?.(this, response)
    } else {
      await this.delegate.requestFailedWithResponse?.(this, response)
    }
  }

  async #requestErrored(error: Error): Promise<void> {
    this.delegate.requestErrored?.(this, error)
  }

  get defaultHeaders(): Record<string, string> {
    return {
      Accept: "text/html, application/xhtml+xml"
    }
  }

  get abortSignal(): AbortSignal {
    return this.abortController.signal
  }

  get isSafe(): boolean {
    return isSafe(this.method)
  }

  acceptResponseType(contentType: string): void {
    this.headers.set("Accept", contentType)
  }
}

function isSafe(fetchMethod: string): boolean {
  return fetchMethod.toLowerCase() === FetchMethod.get
}

function buildResourceAndBody(
  resource: URL,
  method: FetchMethodType,
  requestBody: URLSearchParams | FormData,
  enctype: FetchEnctypeType
): [URL, FormData | URLSearchParams | undefined] {
  const searchParams = Array.from(requestBody).length > 0 ? requestBody : resource.searchParams
  const resourceWithParams = expandURL(resource.href)

  if (isSafe(method)) {
    mergeIntoURLSearchParams(resourceWithParams.searchParams, searchParams)
    return [resourceWithParams, undefined]
  } else if (enctype === FetchEnctype.urlEncoded) {
    return [resource, searchParams]
  } else {
    return [resource, requestBody]
  }
}

function mergeIntoURLSearchParams(target: URLSearchParams, source: URLSearchParams | FormData): void {
  for (const [name, value] of Array.from(source.entries())) {
    if (value instanceof File) continue
    target.append(name, value as string)
  }
}
