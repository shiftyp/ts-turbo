import { doesNotTargetIFrame } from "../util"

export interface FormSubmitDelegate {
  willSubmitForm(form: HTMLFormElement, submitter?: HTMLElement): boolean
  formSubmitted(form: HTMLFormElement, submitter?: HTMLElement): void
}

export class FormSubmitObserver {
  started = false
  readonly delegate: FormSubmitDelegate
  readonly eventTarget: Document | HTMLElement

  constructor(delegate: FormSubmitDelegate, eventTarget: Document | HTMLElement) {
    this.delegate = delegate
    this.eventTarget = eventTarget
  }

  start(): void {
    if (!this.started) {
      this.eventTarget.addEventListener("submit", this.submitCaptured, true)
      this.started = true
    }
  }

  stop(): void {
    if (this.started) {
      this.eventTarget.removeEventListener("submit", this.submitCaptured, true)
      this.started = false
    }
  }

  submitCaptured = (): void => {
    this.eventTarget.removeEventListener("submit", this.submitBubbled, false)
    this.eventTarget.addEventListener("submit", this.submitBubbled, false)
  }

  submitBubbled = (event: Event): void => {
    if (!event.defaultPrevented) {
      const form = event.target instanceof HTMLFormElement ? event.target : undefined
      const submitter = (event as SubmitEvent).submitter || undefined

      if (
        form &&
        submissionDoesNotDismissDialog(form, submitter) &&
        submissionDoesNotTargetIFrame(form, submitter) &&
        this.delegate.willSubmitForm(form, submitter)
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
        this.delegate.formSubmitted(form, submitter)
      }
    }
  }
}

function submissionDoesNotDismissDialog(form: HTMLFormElement, submitter?: HTMLElement): boolean {
  const method = submitter?.getAttribute("formmethod") || form.getAttribute("method")
  return method != "dialog"
}

function submissionDoesNotTargetIFrame(form: HTMLFormElement, submitter?: HTMLElement): boolean {
  const target = submitter?.getAttribute("formtarget") || form.getAttribute("target")
  return doesNotTargetIFrame(target)
}
