import {
  FetchRequest,
  FetchMethod,
  fetchMethodFromString,
  fetchEnctypeFromString,
  isSafe,
} from "../../http/fetch_request"
import { expandURL } from "../url"
import { dispatch, getAttribute, getMetaContent, hasAttribute } from "../../util"
import { StreamMessage } from "../streams/stream_message"
import { FetchResponse } from "../../http/fetch_response"

export type TurboSubmitStartEvent = CustomEvent<{
  formSubmission: FormSubmission
}>

export type TurboSubmitEndEvent = CustomEvent<{
  formSubmission: FormSubmission,
} & Exclude<FormSubmission["result"], undefined>>

export interface FormSubmissionDelegate {
  formSubmissionStarted(formSubmission: FormSubmission): void
  formSubmissionSucceededWithResponse(formSubmission: FormSubmission, fetchResponse: FetchResponse): void
  formSubmissionFailedWithResponse(formSubmission: FormSubmission, fetchResponse: FetchResponse): void
  formSubmissionErrored(formSubmission: FormSubmission, error: Error): void
  formSubmissionFinished(formSubmission: FormSubmission): void
}

export type FormSubmissionResult = { success: boolean; fetchResponse: FetchResponse } | { success: false; error: Error }

export const FormSubmissionState = {
  initialized: "initialized",
  requesting: "requesting",
  waiting: "waiting",
  receiving: "receiving",
  stopping: "stopping",
  stopped: "stopped",
}

export class FormSubmission {
  delegate: FormSubmissionDelegate
  formElement: HTMLFormElement
  submitter: HTMLInputElement | undefined
  formData: FormData | undefined
  fetchRequest: FetchRequest
  mustRedirect: boolean
  state: string | undefined
  originalSubmitText: string | undefined

  result:
    | { success: true; fetchResponse: FetchResponse }
    | { success: false; fetchResponse?: FetchResponse; error?: Error }
    | undefined

  static confirmMethod(message: string, element: HTMLFormElement, submitter: HTMLInputElement | undefined) {
    return Promise.resolve(confirm(message))
  }

  constructor(
    delegate: FormSubmissionDelegate,
    formElement: HTMLFormElement,
    submitter: HTMLInputElement | undefined,
    mustRedirect = false,
  ) {
    const method = getMethod(formElement, submitter)
    const action = getAction(getFormAction(formElement, submitter), method)
    const body = buildFormData(formElement, submitter)
    const enctype = getEnctype(formElement, submitter)

    this.delegate = delegate
    this.formElement = formElement
    this.submitter = submitter
    this.fetchRequest = new FetchRequest(this, method, action, body, formElement, enctype)
    this.mustRedirect = mustRedirect
  }

  get method() {
    return this.fetchRequest.method
  }

  set method(value) {
    this.fetchRequest.method = value
  }

  get action() {
    return this.fetchRequest.url.toString()
  }

  set action(value) {
    this.fetchRequest.url = expandURL(value)
  }

  get body() {
    return this.fetchRequest.body
  }

  get enctype() {
    return this.fetchRequest.enctype
  }

  get isSafe() {
    return this.fetchRequest.isSafe
  }

  get location() {
    return this.fetchRequest.url
  }

  // The submission process

  async start() {
    const { initialized, requesting } = FormSubmissionState
    const confirmationMessage = getAttribute("data-turbo-confirm", this.submitter, this.formElement)

    if (typeof confirmationMessage === "string") {
      const answer = await FormSubmission.confirmMethod(confirmationMessage, this.formElement, this.submitter)
      if (!answer) {
        return
      }
    }

    if (this.state == initialized) {
      this.state = requesting
      return this.fetchRequest.perform()
    }
  }

  stop() {
    const { stopping, stopped } = FormSubmissionState
    if (this.state != stopping && this.state != stopped) {
      this.state = stopping
      this.fetchRequest.cancel()
      return true
    }
  }

  // Fetch request delegate

  prepareRequest(request: FetchRequest) {
    if (!request.isSafe) {
      const token = getCookieValue(getMetaContent("csrf-param")) || getMetaContent("csrf-token")
      if (token) {
        request.headers["X-CSRF-Token"] = token
      }
    }

    if (this.requestAcceptsTurboStreamResponse(request)) {
      request.acceptResponseType(StreamMessage.contentType)
    }
  }

  requestStarted(_request: FetchRequest) {
    this.state = FormSubmissionState.waiting
    this.submitter?.setAttribute("disabled", "")
    this.setSubmitsWith()
    dispatch<TurboSubmitStartEvent>("turbo:submit-start", {
      target: this.formElement,
      detail: { formSubmission: this },
    })
    this.delegate.formSubmissionStarted(this)
  }

  requestPreventedHandlingResponse(request: FetchRequest, response: FetchResponse) {
    this.result = { success: response.succeeded, fetchResponse: response }
  }

  requestSucceededWithResponse(request: FetchRequest, response: FetchResponse) {
    if (response.clientError || response.serverError) {
      this.delegate.formSubmissionFailedWithResponse(this, response)
    } else if (this.requestMustRedirect(request) && responseSucceededWithoutRedirect(response)) {
      const error = new Error("Form responses must redirect to another location")
      this.delegate.formSubmissionErrored(this, error)
    } else {
      this.state = FormSubmissionState.receiving
      this.result = { success: true, fetchResponse: response }
      this.delegate.formSubmissionSucceededWithResponse(this, response)
    }
  }

  requestFailedWithResponse(request: FetchRequest, response: FetchResponse) {
    this.result = { success: false, fetchResponse: response }
    this.delegate.formSubmissionFailedWithResponse(this, response)
  }

  requestErrored(request: FetchRequest, error: Error) {
    this.result = { success: false, error }
    this.delegate.formSubmissionErrored(this, error)
  }

  requestFinished(_request: FetchRequest) {
    this.state = FormSubmissionState.stopped
    this.submitter?.removeAttribute("disabled")
    this.resetSubmitterText()
    dispatch<TurboSubmitEndEvent>("turbo:submit-end", {
      target: this.formElement,
      detail: { formSubmission: this, ...this.result },
    })
    this.delegate.formSubmissionFinished(this)
  }

  // Private

  setSubmitsWith() {
    if (!this.submitter || !this.submitsWith) return

    if (this.submitter.matches("button")) {
      this.originalSubmitText = this.submitter.innerHTML
      this.submitter.innerHTML = this.submitsWith
    } else if (this.submitter.matches("input")) {
      const input = this.submitter
      this.originalSubmitText = input.value
      input.value = this.submitsWith
    }
  }

  resetSubmitterText() {
    if (!this.submitter || !this.originalSubmitText) return

    if (this.submitter.matches("button")) {
      this.submitter.innerHTML = this.originalSubmitText
    } else if (this.submitter.matches("input")) {
      const input = this.submitter
      input.value = this.originalSubmitText
    }
  }

  requestMustRedirect(request: FetchRequest) {
    return !request.isSafe && this.mustRedirect
  }

  requestAcceptsTurboStreamResponse(request: FetchRequest) {
    return !request.isSafe || hasAttribute("data-turbo-stream", this.submitter, this.formElement)
  }

  get submitsWith() {
    return this.submitter?.getAttribute("data-turbo-submits-with")
  }
}

function buildFormData(formElement: HTMLFormElement, submitter: HTMLInputElement | undefined) {
  const formData = new FormData(formElement)
  const name = submitter?.getAttribute("name")
  const value = submitter?.getAttribute("value")

  if (name) {
    formData.append(name, value || "")
  }

  return formData
}

function getCookieValue(cookieName: string | null) {
  if (cookieName != null) {
    const cookies = document.cookie ? document.cookie.split("; ") : []
    const cookie = cookies.find((cookie) => cookie.startsWith(cookieName))
    if (cookie) {
      const value = cookie.split("=").slice(1).join("=")
      return value ? decodeURIComponent(value) : undefined
    }
  }
}

function responseSucceededWithoutRedirect(response: FetchResponse) {
  return response.statusCode == 200 && !response.redirected
}

function getFormAction(formElement: HTMLFormElement, submitter: HTMLInputElement | undefined) {
  const formElementAction = typeof formElement.action === "string" ? formElement.action : null

  if (submitter?.hasAttribute("formaction")) {
    return submitter.getAttribute("formaction") || ""
  } else {
    return formElement.getAttribute("action") || formElementAction || ""
  }
}

function getAction(formAction: string, fetchMethod: FetchMethod) {
  const action = expandURL(formAction)

  if (isSafe(fetchMethod)) {
    action.search = ""
  }

  return action
}

function getMethod(formElement: HTMLFormElement, submitter: HTMLInputElement | undefined) {
  const method = submitter?.getAttribute("formmethod") || formElement.getAttribute("method") || ""
  return fetchMethodFromString(method.toLowerCase() as FetchMethod) || FetchMethod.get
}

function getEnctype(formElement: HTMLFormElement, submitter: HTMLInputElement | undefined) {
  return fetchEnctypeFromString(submitter?.getAttribute("formenctype") || formElement.enctype)
}
