import { FetchRequest } from "../../http/fetch_request"
import { FetchResponse } from "../../http/fetch_response"

export const FormSubmissionState: {
  readonly initialized: "initialized"
  readonly requesting: "requesting"
  readonly waiting: "waiting"
  readonly receiving: "receiving"
  readonly stopping: "stopping"
  readonly stopped: "stopped"
}

export const FormEnctype: {
  readonly urlEncoded: "application/x-www-form-urlencoded"
  readonly multipart: "multipart/form-data"
  readonly plain: "text/plain"
}

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

export class FormSubmission {
  static confirmMethod(message: string): Promise<boolean>

  readonly delegate: FormSubmissionDelegate
  readonly formElement: HTMLFormElement
  readonly submitter?: HTMLElement
  readonly fetchRequest: FetchRequest
  readonly mustRedirect: boolean
  state: typeof FormSubmissionState[keyof typeof FormSubmissionState]
  result?: FormSubmissionResult
  originalSubmitText?: string
  submitsWith?: string

  constructor(
    delegate: FormSubmissionDelegate,
    formElement: HTMLFormElement,
    submitter?: HTMLElement,
    mustRedirect?: boolean
  )

  get method(): string
  set method(value: string)

  get action(): string
  set action(value: string)

  get body(): FormData | URLSearchParams

  get enctype(): string

  get isSafe(): boolean

  get location(): URL

  start(): Promise<void>

  stop(): boolean

  // Fetch request delegate methods
  prepareRequest(request: FetchRequest): void
  requestStarted(request: FetchRequest): void
  requestPreventedHandlingResponse(request: FetchRequest, response: FetchResponse): void
  requestSucceededWithResponse(request: FetchRequest, response: FetchResponse): void
  requestFailedWithResponse(request: FetchRequest, response: FetchResponse): void
  requestErrored(request: FetchRequest, error: Error): void
  requestFinished(request: FetchRequest): void

  private setSubmitsWith(): void
  private resetSubmitterText(): void
  private requestMustRedirect(request: FetchRequest): boolean
  private requestAcceptsTurboStreamResponse(request: FetchRequest): boolean
}
