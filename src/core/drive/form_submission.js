import { FetchRequest, FetchMethod, fetchMethodFromString } from "../../http/fetch_request"
import { expandURL } from "../url"
import { dispatch, getAttribute, getMetaContent, hasAttribute } from "../../util"
import { StreamMessage } from "../streams/stream_message"

export const FormSubmissionState = {
  initialized: "initialized",
  requesting: "requesting",
  waiting: "waiting",
  receiving: "receiving",
  stopping: "stopping",
  stopped: "stopped"
}

export const FormEnctype = {
  urlEncoded: "application/x-www-form-urlencoded",
  multipart: "multipart/form-data",
  plain: "text/plain"
}

function formEnctypeFromString(encoding) {
  switch (encoding.toLowerCase()) {
    case FormEnctype.multipart:
      return FormEnctype.multipart
    case FormEnctype.plain:
      return FormEnctype.plain
    default:
      return FormEnctype.urlEncoded
  }
}

export class FormSubmission {
  state = FormSubmissionState.initialized

  static confirmMethod(message, _element, _submitter) {
    return Promise.resolve(confirm(message))
  }

  constructor(delegate, formElement, submitter, mustRedirect = false) {
    this.delegate = delegate
    this.formElement = formElement
    this.submitter = submitter
    this.formData = buildFormData(formElement, submitter)
    this.location = expandURL(this.action)
    if (this.method == FetchMethod.get) {
      mergeFormDataEntries(this.location, [...this.body.entries()])
    }
    this.fetchRequest = new FetchRequest(this, this.method, this.location, this.body, this.formElement)
    this.mustRedirect = mustRedirect
  }

  get method() {
    const method = this.submitter?.getAttribute("formmethod") || this.formElement.getAttribute("method") || ""
    return fetchMethodFromString(method.toLowerCase()) || FetchMethod.get
  }

  get action() {
    const formElementAction = typeof this.formElement.action === "string" ? this.formElement.action : null

    if (this.submitter?.hasAttribute("formaction")) {
      return this.submitter.getAttribute("formaction") || ""
    } else {
      return this.formElement.getAttribute("action") || formElementAction || ""
    }
  }

  get body() {
    if (this.enctype == FormEnctype.urlEncoded || this.method == FetchMethod.get) {
      return new URLSearchParams(this.stringFormData)
    } else {
      return this.formData
    }
  }

  get enctype() {
    return formEnctypeFromString(this.submitter?.getAttribute("formenctype") || this.formElement.enctype)
  }

  get isSafe() {
    return this.fetchRequest.isSafe
  }

  get stringFormData() {
    return [...this.formData].reduce((entries, [name, value]) => {
      return entries.concat(typeof value == "string" ? [[name, value]] : [])
    }, [])
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

  prepareRequest(fetchRequest) {
    if (!fetchRequest.isSafe) {
      const token = getCookieValue(getMetaContent("csrf-param")) || getMetaContent("csrf-token")
      if (token) {
        fetchRequest.headers.set("X-CSRF-Token", token)
      }
    }

    if (this.requestAcceptsTurboStreamResponse(fetchRequest)) {
      fetchRequest.acceptResponseType(StreamMessage.contentType)
    }
  }

  requestStarted(fetchRequest) {
    const formSubmission = this

    this.state = FormSubmissionState.waiting
    this.submitter?.setAttribute("disabled", "")
    this.setSubmitsWith()
    dispatch("turbo:submit-start", {
      target: this.formElement,
      detail: {
        request: fetchRequest.request,
        submitter: this.submitter,

        get formSubmission() {
          console.warn("`event.detail.formSubmission` is deprecated. Use `event.target`, `event.detail.submitter`, and `event.detail.request` instead")

          return formSubmission
        }
      }
    })
    this.delegate.formSubmissionStarted(this)
  }

  requestPreventedHandlingResponse(fetchRequest, fetchResponse) {
    this.result = { success: fetchResponse.succeeded, fetchResponse: fetchResponse }
  }

  requestSucceededWithResponse(fetchRequest, fetchResponse) {
    if (fetchResponse.clientError || fetchResponse.serverError) {
      this.delegate.formSubmissionFailedWithResponse(this, fetchResponse)
    } else if (this.requestMustRedirect(fetchRequest) && responseSucceededWithoutRedirect(fetchResponse)) {
      const error = new Error("Form responses must redirect to another location")
      this.delegate.formSubmissionErrored(this, error)
    } else {
      this.state = FormSubmissionState.receiving
      this.result = {
        success: true,
        response: fetchResponse.response,

        get fetchResponse() {
          console.warn("`event.detail.fetchResponse` is deprecated. Use `event.detail.response` instead")

          return fetchResponse
        }
      }
      this.delegate.formSubmissionSucceededWithResponse(this, fetchResponse)
    }
  }

  requestFailedWithResponse(fetchRequest, fetchResponse) {
    this.result = {
      success: false,
      response: fetchResponse.response,

      get fetchResponse() {
        console.warn("`event.detail.fetchResponse` is deprecated. Use `event.detail.response` instead")

        return fetchResponse
      }
    }
    this.delegate.formSubmissionFailedWithResponse(this, fetchResponse)
  }

  requestErrored(fetchRequest, error) {
    this.result = { success: false, error }
    this.delegate.formSubmissionErrored(this, error)
  }

  requestFinished(fetchRequest) {
    this.state = FormSubmissionState.stopped
    this.submitter?.removeAttribute("disabled")
    this.resetSubmitterText()
    const { formSubmission } = this

    dispatch("turbo:submit-end", {
      target: this.formElement,
      detail: {
        request: fetchRequest.request,
        submitter: this.submitter,

        get formSubmission() {
          console.warn("`event.detail.formSubmission` is deprecated. Use `event.target`, `event.detail.submitter`, and `event.detail.request` instead")

          return formSubmission
        },

        ...this.result
      }
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

  requestMustRedirect(fetchRequest) {
    return !fetchRequest.isSafe && this.mustRedirect
  }

  requestAcceptsTurboStreamResponse(fetchRequest) {
    return !fetchRequest.isSafe || hasAttribute("data-turbo-stream", this.submitter, this.formElement)
  }

  get submitsWith() {
    return this.submitter?.getAttribute("data-turbo-submits-with")
  }
}

function buildFormData(formElement, submitter) {
  const formData = new FormData(formElement)
  const name = submitter?.getAttribute("name")
  const value = submitter?.getAttribute("value")

  if (name) {
    formData.append(name, value || "")
  }

  return formData
}

function getCookieValue(cookieName) {
  if (cookieName != null) {
    const cookies = document.cookie ? document.cookie.split("; ") : []
    const cookie = cookies.find((cookie) => cookie.startsWith(cookieName))
    if (cookie) {
      const value = cookie.split("=").slice(1).join("=")
      return value ? decodeURIComponent(value) : undefined
    }
  }
}

function responseSucceededWithoutRedirect(response) {
  return response.statusCode == 200 && !response.redirected
}

function mergeFormDataEntries(url, entries) {
  const searchParams = new URLSearchParams()

  for (const [name, value] of entries) {
    if (value instanceof File) continue

    searchParams.append(name, value)
  }

  url.search = searchParams.toString()

  return url
}
