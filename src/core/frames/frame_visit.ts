import { Locatable, expandURL } from "../url"
import { Action } from "../types"
import { clearBusyState, getVisitAction, markAsBusy } from "../../util"
import { FrameElement } from "../../elements/frame_element"
import { FetchRequest, FetchRequestDelegate, FetchMethod } from "../../http/fetch_request"
import { FetchResponse } from "../../http/fetch_response"
import { FormSubmission, FormSubmissionDelegate } from "../drive/form_submission"
import { PageSnapshot } from "../drive/page_snapshot"
import { StreamMessage } from "../streams/stream_message"

type Options = {
  action: Action | null
  acceptsStreamResponse: boolean
  submit: { form: HTMLFormElement; submitter?: HTMLElement }
  url: Locatable
}
type ClickFrameVisitOptions = Partial<Options> & { url: Options["url"] }
type SubmitFrameVisitOptions = Partial<Options> & { submit: Options["submit"] }

export type FrameVisitOptions = ClickFrameVisitOptions | SubmitFrameVisitOptions

export interface FrameVisitDelegate {
  shouldVisit(frameVisit: FrameVisit): boolean
  visitStarted(frameVisit: FrameVisit): void
  visitSucceededWithResponse(frameVisit: FrameVisit, response: FetchResponse): void
  visitFailedWithResponse(frameVisit: FrameVisit, response: FetchResponse): void
  visitErrored(frameVisit: FrameVisit, request: FetchRequest, error: Error): void
  visitCompleted(frameVisit: FrameVisit): void
}

export class FrameVisit implements FetchRequestDelegate, FormSubmissionDelegate {
  readonly delegate: FrameVisitDelegate
  readonly element: FrameElement
  readonly action: Action | null
  readonly previousURL: string | null
  readonly options: FrameVisitOptions
  readonly isFormSubmission: boolean = false
  readonly isSafe: boolean
  readonly acceptsStreamResponse: boolean
  snapshot?: PageSnapshot

  private readonly fetchRequest?: FetchRequest
  private readonly formSubmission?: FormSubmission
  private resolveVisitPromise = () => {}

  static optionsForClick(element: Element, url: URL): ClickFrameVisitOptions {
    const action = getVisitAction(element)
    const acceptsStreamResponse = element.hasAttribute("data-turbo-stream")

    return { acceptsStreamResponse, action, url }
  }

  static optionsForSubmit(form: HTMLFormElement, submitter?: HTMLElement): SubmitFrameVisitOptions {
    const action = getVisitAction(form, submitter)

    return { action, submit: { form, submitter } }
  }

  constructor(delegate: FrameVisitDelegate, element: FrameElement, options: FrameVisitOptions) {
    this.delegate = delegate
    this.element = element
    this.previousURL = this.element.src

    const { acceptsStreamResponse, action, url, submit } = (this.options = options)

    this.acceptsStreamResponse = acceptsStreamResponse || false
    this.action = action || getVisitAction(this.element)

    if (submit) {
      const { fetchRequest } = (this.formSubmission = new FormSubmission(this, submit.form, submit.submitter))
      this.prepareRequest(fetchRequest)
      this.isFormSubmission = true
      this.isSafe = this.formSubmission.isSafe
    } else if (url) {
      this.fetchRequest = new FetchRequest(this, FetchMethod.get, expandURL(url), new URLSearchParams(), this.element)
      this.isSafe = true
    } else {
      throw new Error("FrameVisit must be constructed with either a url: or submit: option")
    }
  }

  async start(): Promise<void> {
    if (this.delegate.shouldVisit(this)) {
      if (this.action) {
        this.snapshot = PageSnapshot.fromElement(this.element).clone()
      }

      if (this.formSubmission) {
        await this.formSubmission.start()
      } else {
        await this.performRequest()
      }

      return this.element.loaded
    } else {
      return Promise.resolve()
    }
  }

  stop() {
    this.fetchRequest?.cancel()
    this.formSubmission?.stop()
  }

  // Fetch request delegate

  prepareRequest(request: FetchRequest) {
    request.headers["Turbo-Frame"] = this.element.id

    if (this.acceptsStreamResponse || this.isFormSubmission) {
      request.acceptResponseType(StreamMessage.contentType)
    }
  }

  requestStarted(request: FetchRequest) {
    this.delegate.visitStarted(this)

    if (request.target instanceof HTMLFormElement) {
      markAsBusy(request.target)
    }

    markAsBusy(this.element)
  }

  requestPreventedHandlingResponse(_request: FetchRequest, _response: FetchResponse) {
    this.resolveVisitPromise()
  }

  requestFinished(request: FetchRequest) {
    clearBusyState(this.element)

    if (request.target instanceof HTMLFormElement) {
      clearBusyState(request.target)
    }

    this.delegate.visitCompleted(this)
  }

  async requestSucceededWithResponse(fetchRequest: FetchRequest, fetchResponse: FetchResponse) {
    await this.delegate.visitSucceededWithResponse(this, fetchResponse)
    this.resolveVisitPromise()
  }

  async requestFailedWithResponse(request: FetchRequest, fetchResponse: FetchResponse) {
    console.error(fetchResponse)
    await this.delegate.visitFailedWithResponse(this, fetchResponse)
    this.resolveVisitPromise()
  }

  requestErrored(request: FetchRequest, error: Error) {
    this.delegate.visitErrored(this, request, error)
    this.resolveVisitPromise()
  }

  // Form submission delegate

  formSubmissionStarted({ fetchRequest }: FormSubmission) {
    this.requestStarted(fetchRequest)
  }

  async formSubmissionSucceededWithResponse({ fetchRequest }: FormSubmission, response: FetchResponse) {
    await this.requestSucceededWithResponse(fetchRequest, response)
  }

  async formSubmissionFailedWithResponse({ fetchRequest }: FormSubmission, fetchResponse: FetchResponse) {
    await this.requestFailedWithResponse(fetchRequest, fetchResponse)
  }

  formSubmissionErrored({ fetchRequest }: FormSubmission, error: Error) {
    this.requestErrored(fetchRequest, error)
  }

  formSubmissionFinished({ fetchRequest }: FormSubmission) {
    this.requestFinished(fetchRequest)
  }

  private performRequest() {
    this.element.loaded = new Promise<void>((resolve) => {
      this.resolveVisitPromise = () => {
        this.resolveVisitPromise = () => {}
        resolve()
      }
      this.fetchRequest?.perform()
    })
  }
}
