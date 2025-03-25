import { ProgressBar } from "../drive/progress_bar"
import { Visit, SystemStatusCode } from "../drive/visit"
import { FormSubmission } from "../drive/form_submission"
import { Session } from "../session"
import { Navigator } from "../drive/navigator"

export interface ReloadReason {
  reason: string
  context?: {
    statusCode?: SystemStatusCode
  }
}

export class BrowserAdapter {
  readonly progressBar: ProgressBar
  readonly session: Session
  location?: URL
  visitProgressBarTimeout?: number
  formProgressBarTimeout?: number

  constructor(session: Session)

  visitProposedToLocation(location: URL, options?: { restorationIdentifier?: string }): void

  visitStarted(visit: Visit): void

  visitRequestStarted(visit: Visit): void

  visitRequestCompleted(visit: Visit): void

  visitRequestFailedWithStatusCode(visit: Visit, statusCode: SystemStatusCode): void

  visitRequestFinished(visit: Visit): void

  visitCompleted(visit: Visit): void

  pageInvalidated(reason: ReloadReason): void

  visitFailed(visit: Visit): void

  visitRendered(visit: Visit): void

  linkPrefetchingIsEnabledForLocation(location: URL): boolean

  formSubmissionStarted(formSubmission: FormSubmission): void

  formSubmissionFinished(formSubmission: FormSubmission): void

  private showVisitProgressBarAfterDelay(): void

  private hideVisitProgressBar(): void

  private showFormProgressBarAfterDelay(): void

  private hideFormProgressBar(): void

  private showProgressBar: () => void

  private reload(reason: ReloadReason): void

  get navigator(): Navigator
}
