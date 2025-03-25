import { FetchRequest, FetchMethod, FetchRequestDelegate, fetchMethodFromString, fetchEnctypeFromString, FetchMethodType, FetchEnctypeType } from "../../http/fetch_request.js"
import { FetchResponse } from "../../http/fetch_response.js"
import { expandURL } from "../url.js"
import { clearBusyState, dispatch, getAttribute, getMetaContent, hasAttribute, markAsBusy } from "../../util"
import { StreamMessage } from "../streams/stream_message.js"
import { prefetchCache } from "./prefetch_cache.js"
import { config } from "../config/index.js"

export const FormSubmissionState = {
  initialized: "initialized",
  requesting: "requesting",
  waiting: "waiting",
  receiving: "receiving",
  stopping: "stopping",
  stopped: "stopped"
} as const

export type FormSubmissionStateType = typeof FormSubmissionState[keyof typeof FormSubmissionState]

export const FormEnctype = {
  urlEncoded: "application/x-www-form-urlencoded",
  multipart: "multipart/form-data",
  plain: "text/plain"
} as const

export interface FormSubmissionDelegate {
  formSubmissionStarted(formSubmission: FormSubmission): void
  formSubmissionSucceededWithResponse(formSubmission: FormSubmission, response: FetchResponse): void
  formSubmissionFailedWithResponse(formSubmission: FormSubmission, response: FetchResponse): void
  formSubmissionErrored(formSubmission: FormSubmission, error: Error): void
  formSubmissionFinished(formSubmission: FormSubmission): void
}

export interface FormSubmissionResult {
  success: boolean
  fetchResponse?: FetchResponse
  error?: Error
}

export class FormSubmission implements FetchRequestDelegate {
  readonly delegate: FormSubmissionDelegate
  readonly formElement: HTMLFormElement
  readonly submitter?: HTMLElement
  fetchRequest!: FetchRequest
  readonly mustRedirect: boolean
  state: FormSubmissionStateType = FormSubmissionState.initialized
  result?: FormSubmissionResult
  originalSubmitText?: string
  submitsWith?: string
  referrer?: URL

  static async confirmMethod(message: string): Promise<boolean> {
    return Promise.resolve(confirm(message))
  }

  constructor(
    delegate: FormSubmissionDelegate,
    formElement: HTMLFormElement,
    submitter?: HTMLElement,
    mustRedirect: boolean = false
  ) {
    const method = getMethod(formElement, submitter)
    const action = getAction(getFormAction(formElement, submitter), method)
    const body = buildFormData(formElement, submitter)
    const enctype = getEnctype(formElement, submitter) as FetchEnctypeType

    this.delegate = delegate
    this.formElement = formElement
    this.submitter = submitter
    this.mustRedirect = mustRedirect
    
    // Initialize fetchRequest after all properties are set
    this.fetchRequest = new FetchRequest(this, method, action, body, formElement, enctype)
  }

  get method(): string {
    return this.fetchRequest.method.toString()
  }

  set method(value: string) {
    const fetchMethod = fetchMethodFromString(value)
    if (fetchMethod) {
      this.fetchRequest.fetchOptions.method = fetchMethod.toUpperCase()
    }
  }

  get action(): string {
    return this.fetchRequest.url.toString()
  }

  set action(value: string) {
    // Cannot directly set url property on fetchOptions
    // We need to reconstruct the FetchRequest with the new URL
    const newUrl = expandURL(value)
    const method = this.fetchRequest.fetchOptions.method as string
    const body = this.body
    this.fetchRequest = new FetchRequest(
      this, 
      method.toLowerCase() as FetchMethodType, 
      newUrl, 
      body, 
      this.formElement, 
      this.enctype as FetchEnctypeType
    )
  }

  get body(): FormData | URLSearchParams {
    return this.fetchRequest.body
  }

  get enctype(): string {
    return this.fetchRequest.enctype
  }

  get isSafe(): boolean {
    return this.fetchRequest.isSafe
  }

  get location(): URL {
    return this.fetchRequest.url
  }

  // The submission process

  async start(): Promise<boolean | void> {
    const { initialized, requesting } = FormSubmissionState
    const confirmationMessage = getAttribute("data-turbo-confirm", this.submitter, this.formElement)

    if (typeof confirmationMessage === "string") {
      // Use type assertion to access potentially undefined properties
      const formsConfig = config.forms as any
      const confirmMethod = typeof formsConfig?.confirm === "function" ?
        formsConfig.confirm :
        FormSubmission.confirmMethod

      const answer = await confirmMethod(confirmationMessage, this.formElement, this.submitter)
      if (!answer) {
        return
      }
    }

    if (this.state === initialized) {
      this.state = requesting
      const response = await this.fetchRequest.perform()
      return true // Return true to indicate submission was sent
    }
    return false
  }

  stop(): boolean {
    const { stopping, stopped } = FormSubmissionState
    if (this.state !== stopping && this.state !== stopped) {
      this.state = stopping
      this.fetchRequest.cancel()
      return true
    }
    return false
  }

  // Fetch request delegate

  prepareRequest(request: FetchRequest): void {
    if (!request.isSafe) {
      const token = getCookieValue(getMetaContent("csrf-param")) || getMetaContent("csrf-token")
      if (token) {
        request.fetchOptions.headers = { ...request.fetchOptions.headers as Record<string, string>, "X-CSRF-Token": token }
      }
    }

    if (this.requestAcceptsTurboStreamResponse(request)) {
      // Set accept header for StreamMessage content type
  request.fetchOptions.headers = { 
    ...request.fetchOptions.headers as Record<string, string>, 
    "Accept": StreamMessage.contentType 
  }
    }
  }

  requestStarted(request: FetchRequest): void {
    this.state = FormSubmissionState.waiting
    if (this.submitter && (config.forms as any)?.submitter?.beforeSubmit) {
      (config.forms as any).submitter.beforeSubmit(this.submitter)
    }
    this.setSubmitsWith()
    markAsBusy(this.formElement)
    dispatch("turbo:submit-start", {
      target: this.formElement,
      detail: { formSubmission: this }
    })
    this.delegate.formSubmissionStarted(this)
  }

  requestPreventedHandlingResponse(request: FetchRequest, response: FetchResponse): void {
    prefetchCache.clear()
    this.result = { success: response.succeeded, fetchResponse: response }
  }

  async requestSucceededWithResponse(request: FetchRequest, response: FetchResponse): Promise<void> {
    if (response.response.status >= 400 && response.response.status <= 599) {
      this.delegate.formSubmissionFailedWithResponse(this, response)
      return
    }

    prefetchCache.clear()

    if (this.requestMustRedirect(request) && !response.response.redirected) {
      const error = new Error("Form responses must redirect to another location")
      this.delegate.formSubmissionErrored(this, error)
    } else {
      this.state = FormSubmissionState.receiving
      this.result = { success: true, fetchResponse: response }
      this.delegate.formSubmissionSucceededWithResponse(this, response)
    }
  }

  async requestFailedWithResponse(request: FetchRequest, response: FetchResponse): Promise<void> {
    this.result = { success: false, fetchResponse: response }
    this.delegate.formSubmissionFailedWithResponse(this, response)
  }

  requestErrored(request: FetchRequest, error: Error): void {
    this.result = { success: false, error }
    this.delegate.formSubmissionErrored(this, error)
  }

  requestFinished(request: FetchRequest): void {
    this.state = FormSubmissionState.stopped
    if (this.submitter && (config.forms as any)?.submitter?.afterSubmit) {
      (config.forms as any).submitter.afterSubmit(this.submitter)
    }
    this.resetSubmitterText()
    clearBusyState(this.formElement)
    dispatch("turbo:submit-end", {
      target: this.formElement,
      detail: { formSubmission: this, ...this.result }
    })
    this.delegate.formSubmissionFinished(this)
  }

  // Private

  private setSubmitsWith(): void {
    if (!this.submitter || !this.submitsWith) return

    if (this.submitter.matches("button")) {
      this.originalSubmitText = this.submitter.innerHTML
      this.submitter.innerHTML = this.submitsWith
    } else if (this.submitter.matches("input")) {
      const input = this.submitter as HTMLInputElement
      this.originalSubmitText = input.value
      input.value = this.submitsWith
    }
  }

  private resetSubmitterText(): void {
    if (!this.submitter || !this.originalSubmitText) return

    if (this.submitter.matches("button")) {
      this.submitter.innerHTML = this.originalSubmitText
    } else if (this.submitter.matches("input")) {
      const input = this.submitter as HTMLInputElement
      input.value = this.originalSubmitText
    }
  }

  private requestMustRedirect(request: FetchRequest): boolean {
    return !request.isSafe && this.mustRedirect
  }

  private requestAcceptsTurboStreamResponse(request: FetchRequest): boolean {
    // hasAttribute accepts (Element | null | undefined)[] so this is type-safe with HTMLElement | undefined
    return !request.isSafe || hasAttribute("data-turbo-stream", this.submitter, this.formElement)
  }
}

// Private functions

function buildFormData(formElement: HTMLFormElement, submitter?: HTMLElement): FormData | URLSearchParams {
  const formData = new FormData(formElement)
  const name = submitter?.getAttribute("name")
  const value = submitter?.getAttribute("value")

  if (name && value != null && formData.get(name) != value) {
    formData.append(name, value)
  }

  return formData
}

function getCookieValue(cookieName: string | null): string | null {
  if (cookieName != null) {
    const cookies = document.cookie ? document.cookie.split("; ") : []
    const cookie = cookies.find((cookie) => cookie.startsWith(cookieName))
    if (cookie) {
      const value = cookie.split("=").slice(1).join("=")
      return value ? decodeURIComponent(value) : null
    }
  }
  return null
}

function getFormAction(formElement: HTMLFormElement, submitter?: HTMLElement | null): string {
  const action = submitter?.getAttribute("formaction") || formElement.getAttribute("action") || ""
  return expandURL(action).href
}

function getAction(formAction: string, fetchMethod: FetchMethodType): URL {
  const url = expandURL(formAction)
  if (fetchMethod === "get") {
    url.search = ""
  }
  return url
}

function getMethod(formElement: HTMLFormElement, submitter?: HTMLElement | null): FetchMethodType {
  const method = submitter?.getAttribute("formmethod") || formElement.getAttribute("method") || ""
  return fetchMethodFromString(method.toLowerCase()) || FetchMethod.get
}

function getEnctype(formElement: HTMLFormElement, submitter?: HTMLElement | null): string {
  return fetchEnctypeFromString(
    submitter?.getAttribute("formenctype") || formElement.getAttribute("enctype") || FormEnctype.urlEncoded
  )
}
