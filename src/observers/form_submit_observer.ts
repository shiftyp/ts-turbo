import { HTMLFormSubmission } from "../core/drive/html_form_submission"

export interface FormSubmitObserverDelegate {
  willSubmitForm(submission: HTMLFormSubmission): boolean
  formSubmitted(submission: HTMLFormSubmission): void
}

export class FormSubmitObserver {
  readonly delegate: FormSubmitObserverDelegate
  readonly eventTarget: EventTarget
  started = false

  constructor(delegate: FormSubmitObserverDelegate, eventTarget: EventTarget) {
    this.delegate = delegate
    this.eventTarget = eventTarget
  }

  start() {
    if (!this.started) {
      this.eventTarget.addEventListener("submit", this.submitCaptured, true)
      this.started = true
    }
  }

  stop() {
    if (this.started) {
      this.eventTarget.removeEventListener("submit", this.submitCaptured, true)
      this.started = false
    }
  }

  submitCaptured = () => {
    this.eventTarget.removeEventListener("submit", this.submitBubbled, false)
    this.eventTarget.addEventListener("submit", this.submitBubbled, false)
  }

  submitBubbled = <EventListener>((event: SubmitEvent) => {
    if (!event.defaultPrevented) {
      const submission =
        event.target instanceof HTMLFormElement
          ? new HTMLFormSubmission(event.target, event.submitter || undefined)
          : undefined

      if (
        submission &&
        submissionDoesNotDismissDialog(submission) &&
        submissionDoesNotTargetIFrame(submission) &&
        this.delegate.willSubmitForm(submission)
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
        this.delegate.formSubmitted(submission)
      }
    }
  })
}

function submissionDoesNotDismissDialog({ method }: HTMLFormSubmission): boolean {
  return method != "dialog"
}

function submissionDoesNotTargetIFrame({ target }: HTMLFormSubmission): boolean {
  if (target) {
    for (const element of document.getElementsByName(target)) {
      if (element instanceof HTMLIFrameElement) return false
    }

    return true
  } else {
    return true
  }
}
