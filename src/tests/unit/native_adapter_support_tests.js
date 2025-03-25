import * as Turbo from "../../index"
import { assert } from "@open-wc/testing"
import { FormSubmission } from "../../core/drive/form_submission"

class NativeAdapterSupportTest {
  constructor() {
    this.proposedVisits = []
    this.startedVisits = []
    this.completedVisits = []
    this.startedVisitRequests = []
    this.completedVisitRequests = []
    this.failedVisitRequests = []
    this.finishedVisitRequests = []
    this.startedFormSubmissions = []
    this.finishedFormSubmissions = []
    this.linkPrefetchRequests = []
  }

  // Adapter interface
  visitProposedToLocation(location, options) {
    this.proposedVisits.push({ location, options })
  }

  visitStarted(visit) {
    this.startedVisits.push(visit)
  }

  visitCompleted(visit) {
    this.completedVisits.push(visit)
  }

  visitRequestStarted(visit) {
    this.startedVisitRequests.push(visit)
  }

  visitRequestCompleted(visit) {
    this.completedVisitRequests.push(visit)
  }

  visitRequestFailedWithStatusCode(visit, _statusCode) {
    this.failedVisitRequests.push(visit)
  }

  visitRequestFinished(visit) {
    this.finishedVisitRequests.push(visit)
  }

  visitRendered(_visit) {}

  formSubmissionStarted(formSubmission) {
    this.startedFormSubmissions.push(formSubmission)
  }

  formSubmissionFinished(formSubmission) {
    this.finishedFormSubmissions.push(formSubmission)
  }

  pageInvalidated() {}

  linkPrefetchingIsEnabledForLocation(location) {
    this.linkPrefetchRequests.push(location)
  }
}

let adapter

setup(() => {
  adapter = new NativeAdapterSupportTest()
  Turbo.registerAdapter(adapter)
})

test("navigator adapter is native adapter", async () => {
  assert.equal(adapter, Turbo.navigator.adapter)
})

test("visit proposal location is proposed to adapter", async () => {
  const url = new URL(window.location.toString())

  Turbo.navigator.proposeVisit(url)
  assert.equal(adapter.proposedVisits.length, 1)

  const [visit] = adapter.proposedVisits
  assert.equal(visit.location, url)
})

test("visit proposal external location is proposed to adapter", async () => {
  const url = new URL("https://example.com/")

  Turbo.navigator.proposeVisit(url)
  assert.equal(adapter.proposedVisits.length, 1)

  const [visit] = adapter.proposedVisits
  assert.equal(visit.location, url)
})

test("visit started notifies adapter", async () => {
  const locatable = window.location.toString()

  Turbo.navigator.startVisit(locatable)
  assert.equal(adapter.startedVisits.length, 2)

  const [visit] = adapter.startedVisits
  assert.equal(visit.location, locatable)
})

test("test visit has cached snapshot returns boolean", async () => {
  const locatable = window.location.toString()

  await Turbo.navigator.startVisit(locatable)

  const [visit] = adapter.startedVisits
  assert.equal(visit.hasCachedSnapshot(), false)
})

test("visit completed notifies adapter", async () => {
  const locatable = window.location.toString()

  Turbo.navigator.startVisit(locatable)

  const [startedVisit] = adapter.startedVisits
  startedVisit.complete()

  const [completedVisit] = adapter.completedVisits
  assert.equal(completedVisit.location, locatable)
})

test("visit request started notifies adapter", async () => {
  const locatable = window.location.toString()

  Turbo.navigator.startVisit(locatable)

  const [startedVisit] = adapter.startedVisits
  startedVisit.startRequest()
  assert.equal(adapter.startedVisitRequests.length, 1)

  const [startedVisitRequest] = adapter.startedVisitRequests
  assert.equal(startedVisitRequest.location, locatable)
})

test("visit request completed notifies adapter", async () => {
  const locatable = window.location.toString()

  Turbo.navigator.startVisit(locatable)

  const [startedVisit] = adapter.startedVisits
  startedVisit.recordResponse({ statusCode: 200, responseHTML: "responseHtml", redirected: false })
  assert.equal(adapter.completedVisitRequests.length, 1)

  const [completedVisitRequest] = adapter.completedVisitRequests
  assert.equal(completedVisitRequest.location, locatable)
})

test("visit request failed notifies adapter", async () => {
  const locatable = window.location.toString()

  Turbo.navigator.startVisit(locatable)

  const [startedVisit] = adapter.startedVisits
  startedVisit.recordResponse({ statusCode: 404, responseHTML: "responseHtml", redirected: false })
  assert.equal(adapter.failedVisitRequests.length, 1)

  const [failedVisitRequest] = adapter.failedVisitRequests
  assert.equal(failedVisitRequest.location, locatable)
})

test("visit request finished notifies adapter", async () => {
  const locatable = window.location.toString()

  Turbo.navigator.startVisit(locatable)

  const [startedVisit] = adapter.startedVisits
  startedVisit.finishRequest()
  assert.equal(adapter.finishedVisitRequests.length, 1)

  const [finishedVisitRequest] = adapter.finishedVisitRequests
  assert.equal(finishedVisitRequest.location, locatable)
})

test("form submission started notifies adapter", async () => {
  Turbo.navigator.formSubmissionStarted("formSubmissionStub")
  assert.equal(adapter.startedFormSubmissions.length, 1)

  const [startedFormSubmission] = adapter.startedFormSubmissions
  assert.equal(startedFormSubmission, "formSubmissionStub")
})

test("form submission finished notifies adapter", async () => {
  Turbo.navigator.formSubmissionFinished("formSubmissionStub")
  assert.equal(adapter.finishedFormSubmissions.length, 1)

  const [finishedFormSubmission] = adapter.finishedFormSubmissions
  assert.equal(finishedFormSubmission, "formSubmissionStub")
})

test("visit follows redirect and proposes replace visit to adapter", async () => {
  const locatable = window.location.toString()
  const redirectedLocation = "https://example.com"

  // Clear the proposedVisits array before the test
  adapter.proposedVisits = []
  
  Turbo.navigator.startVisit(locatable)

  const [startedVisit] = adapter.startedVisits
  // Create a response object with redirected set to true
  startedVisit.response = {
    redirected: true,
    location: redirectedLocation
  }
  startedVisit.redirectedToLocation = redirectedLocation
  
  // Call followRedirect to trigger the visitProposedToLocation
  startedVisit.followRedirect()
  
  assert.equal(adapter.proposedVisits.length, 1)

  const [visit] = adapter.proposedVisits
  assert.equal(visit.location, redirectedLocation)
  assert.equal(visit.options.action, "replace")
})

test("link prefetch requests verify with adapter", async () => {
  const locatable = window.location.toString()

  Turbo.navigator.linkPrefetchingIsEnabledForLocation(locatable)
  assert.equal(adapter.linkPrefetchRequests.length, 1)

  const [location] = adapter.linkPrefetchRequests
  assert.equal(location, locatable)
})
