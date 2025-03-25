import { getVisitAction } from "../../util"
import { FormSubmission } from "./form_submission"
import { expandURL, getAnchor, getRequestURL } from "../url"
import { Visit, VisitDelegate, VisitOptions as VisitOptionsFromVisit } from "./visit"
import { PageSnapshot } from "./page_snapshot"
import { NavigatorDelegate, VisitOptions } from "../types"
import { FetchResponse } from "../../http/fetch_response"

export class Navigator {
  currentVisit?: Visit
  formSubmission?: FormSubmission
  readonly delegate: NavigatorDelegate

  constructor(delegate: NavigatorDelegate) {
    this.delegate = delegate
  }

  proposeVisit(location: URL, options: VisitOptions = {}): void {
    if (this.delegate.allowsVisitingLocationWithAction(location, options.action)) {
      this.delegate.visitProposedToLocation(location, options)
    }
  }

  startVisit(locatable: string | URL, restorationIdentifier?: string, options: VisitOptions = {}): void {
    this.stop()
    
    // Handle the referrer conversion
    let referrer: URL | undefined = this.location;
    if (options.referrer) {
      referrer = typeof options.referrer === 'string' ? new URL(options.referrer) : options.referrer;
    }
    
    // Create a visitOptions object with only the properties that exist in both interfaces
    const visitOptions: VisitOptionsFromVisit = {
      action: options.action,
      historyChanged: options.historyChanged,
      referrer: referrer,
      snapshotHTML: options.snapshotHTML,
      shouldCacheSnapshot: options.shouldCacheSnapshot,
      // Handle response type difference with a conditional cast
      ...(options.response && { response: options.response as any }),
      // Direction is more strictly typed in one interface
      direction: options.direction as string | undefined
    };
    
    this.currentVisit = new Visit(this as unknown as VisitDelegate, expandURL(locatable), restorationIdentifier, visitOptions)
    this.currentVisit.start()
  }

  submitForm(form: HTMLFormElement, submitter?: HTMLElement): void {
    this.stop()
    this.formSubmission = new FormSubmission(this, form, submitter, true)
    this.formSubmission.start()
  }

  stop(): void {
    if (this.formSubmission) {
      this.formSubmission.stop()
      delete this.formSubmission
    }

    if (this.currentVisit) {
      this.currentVisit.cancel()
      delete this.currentVisit
    }
  }

  get adapter() {
    return this.delegate.adapter
  }

  get view() {
    return this.delegate.view
  }

  get rootLocation(): URL {
    // Check if view and snapshot exist before accessing rootLocation
    if (!this.view || !this.view.snapshot) {
      return new URL(window.location.href)
    }
    return this.view.snapshot.rootLocation
  }

  get history() {
    return this.delegate.history
  }

  // Form submission delegate

  formSubmissionStarted(formSubmission: FormSubmission): void {
    // Not all adapters implement formSubmissionStarted
    if (typeof this.adapter.formSubmissionStarted === "function") {
      this.adapter.formSubmissionStarted(formSubmission)
    }
  }

  async formSubmissionSucceededWithResponse(formSubmission: FormSubmission, fetchResponse: FetchResponse): Promise<void> {
    if (formSubmission == this.formSubmission) {
      const responseHTML = await fetchResponse.responseHTML
      if (responseHTML) {
        const shouldCacheSnapshot = formSubmission.isSafe
        if (!shouldCacheSnapshot) {
          this.view.clearSnapshotCache()
        }

        const { statusCode, redirected } = fetchResponse
        const action = this.#getActionForFormSubmission(formSubmission, fetchResponse)
        const visitOptions = {
          action,
          shouldCacheSnapshot,
          response: { statusCode, responseHTML, redirected }
        }
        this.proposeVisit(fetchResponse.location, visitOptions)
      }
    }
  }

  async formSubmissionFailedWithResponse(formSubmission: FormSubmission, fetchResponse: FetchResponse): Promise<void> {
    const responseHTML = await fetchResponse.responseHTML

    if (responseHTML) {
      const snapshot = PageSnapshot.fromHTMLString(responseHTML)
      if (fetchResponse.serverError) {
        await this.view.renderError(snapshot, this.currentVisit)
      } else {
        await this.view.renderPage(snapshot, false, true, this.currentVisit)
      }
      if(!snapshot.shouldPreserveScrollPosition) {
        this.view.scrollToTop()
      }
      this.view.clearSnapshotCache()
    }
  }

  formSubmissionErrored(formSubmission: FormSubmission, error: Error): void {
    console.error(error)
  }

  formSubmissionFinished(formSubmission: FormSubmission): void {
    // Not all adapters implement formSubmissionFinished
    if (typeof this.adapter.formSubmissionFinished === "function") {
      this.adapter.formSubmissionFinished(formSubmission)
    }
  }

  // Link prefetching

  linkPrefetchingIsEnabledForLocation(location: URL): boolean {
    // Not all adapters implement linkPrefetchingIsEnabledForLocation
    if (typeof this.adapter.linkPrefetchingIsEnabledForLocation === "function") {
      return this.adapter.linkPrefetchingIsEnabledForLocation(location)
    }
    return true
  }

  // Visit delegate

  visitStarted(visit: Visit): void {
    this.delegate.visitStarted(visit)
  }

  visitCompleted(visit: Visit): void {
    this.delegate.visitCompleted(visit)
    delete this.currentVisit
  }

  locationWithActionIsSamePage(location: URL, action?: string): boolean {
    const anchor = getAnchor(location)
    const currentAnchor = getAnchor(this.view.lastRenderedLocation)
    const isRestorationToTop = action === "restore" && typeof anchor === "undefined"

    return (
      action !== "replace" &&
      getRequestURL(location) === getRequestURL(this.view.lastRenderedLocation) &&
      (isRestorationToTop || (anchor != null && anchor !== currentAnchor))
    )
  }

  visitScrolledToSamePageLocation(oldURL: URL, newURL: URL): void {
    this.delegate.visitScrolledToSamePageLocation(oldURL, newURL)
  }

  // Visits

  get location(): URL | undefined {
    return this.history.location
  }

  get restorationIdentifier(): string {
    return this.history.restorationIdentifier
  }

  #getActionForFormSubmission(formSubmission: FormSubmission, fetchResponse: FetchResponse): string {
    const { submitter, formElement } = formSubmission
    return getVisitAction(submitter, formElement) || this.#getDefaultAction(fetchResponse)
  }

  #getDefaultAction(fetchResponse: FetchResponse): "replace" | "advance" {
    const sameLocationRedirect = fetchResponse.redirected && fetchResponse.location.href === this.location?.href
    return sameLocationRedirect ? "replace" : "advance"
  }
}
