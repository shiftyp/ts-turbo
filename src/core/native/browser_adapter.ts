import { ProgressBar } from "../drive/progress_bar"
import { SystemStatusCode, Visit } from "../drive/visit"
import { uuid, dispatch } from "../../util"
import { locationIsVisitable } from "../url"
import { FormSubmission } from "../drive/form_submission"
import { Session } from "../session"
import { Navigator } from "../drive/navigator"
import { VisitOptions, ReloadReason } from "../types"

// Using ReloadReason from types.ts

export class BrowserAdapter {
  readonly progressBar = new ProgressBar()
  readonly session: Session
  private visitProgressBarTimeout?: number
  private formProgressBarTimeout?: number
  private location?: URL

  constructor(session: Session) {
    this.session = session
  }

  visitProposedToLocation(location: URL, options?: VisitOptions): void {
    if (locationIsVisitable(location, this.navigator.rootLocation)) {
      this.navigator.startVisit(location, options?.restorationIdentifier || uuid(), options)
    } else {
      window.location.href = location.toString()
    }
  }

  visitStarted(visit: Visit): void {
    this.location = visit.location
    visit.loadCachedSnapshot()
    visit.issueRequest()
    visit.goToSamePageAnchor()
  }

  visitRequestStarted(visit: Visit): void {
    this.progressBar.setValue(0)
    if (visit.hasCachedSnapshot() || visit.action != "restore") {
      this.showVisitProgressBarAfterDelay()
    } else {
      this.showProgressBar()
    }
  }

  visitRequestCompleted(visit: Visit): void {
    visit.loadResponse()
  }

  visitRequestFailedWithStatusCode(visit: Visit, statusCode: number): void {
    switch (statusCode) {
      case SystemStatusCode.networkFailure:
      case SystemStatusCode.timeoutFailure:
      case SystemStatusCode.contentTypeMismatch:
        return this.reload({
          reason: "request_failed",
          context: {
            statusCode
          }
        })
      default:
        return visit.loadResponse()
    }
  }

  visitRequestFinished(_visit: Visit): void {}

  visitCompleted(_visit: Visit): void {
    this.progressBar.setValue(1)
    this.hideVisitProgressBar()
  }

  pageInvalidated(reason: ReloadReason): void {
    this.reload(reason)
  }

  visitFailed(_visit: Visit): void {
    this.progressBar.setValue(1)
    this.hideVisitProgressBar()
  }

  visitRendered(_visit: Visit): void {}

  // Link prefetching

  linkPrefetchingIsEnabledForLocation(_location: URL): boolean {
    return true
  }

  // Form Submission Delegate

  formSubmissionStarted(_formSubmission: FormSubmission): void {
    this.progressBar.setValue(0)
    this.showFormProgressBarAfterDelay()
  }

  formSubmissionFinished(_formSubmission: FormSubmission): void {
    this.progressBar.setValue(1)
    this.hideFormProgressBar()
  }

  // Private

  private showVisitProgressBarAfterDelay(): void {
    this.visitProgressBarTimeout = window.setTimeout(this.showProgressBar, this.session.progressBarDelay)
  }

  private hideVisitProgressBar(): void {
    this.progressBar.hide()
    if (this.visitProgressBarTimeout != null) {
      window.clearTimeout(this.visitProgressBarTimeout)
      delete this.visitProgressBarTimeout
    }
  }

  private showFormProgressBarAfterDelay(): void {
    if (this.formProgressBarTimeout == null) {
      this.formProgressBarTimeout = window.setTimeout(this.showProgressBar, this.session.progressBarDelay)
    }
  }

  private hideFormProgressBar(): void {
    this.progressBar.hide()
    if (this.formProgressBarTimeout != null) {
      window.clearTimeout(this.formProgressBarTimeout)
      delete this.formProgressBarTimeout
    }
  }

  private showProgressBar = (): void => {
    this.progressBar.show()
  }

  private reload(reason: ReloadReason): void {
    dispatch("turbo:reload", { detail: reason })
    window.location.href = this.location?.toString() || window.location.href
  }

  private get navigator(): Navigator {
    return this.session.navigator
  }
}
