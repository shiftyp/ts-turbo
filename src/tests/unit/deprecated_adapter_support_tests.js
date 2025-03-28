import * as Turbo from "../../index"
import { assert, fixture, html } from "@open-wc/testing"

class DeprecatedAdapterSupportTest {
  constructor() {
    this.locations = []
  }
  
  // Adapter interface
  visitProposedToLocation(location, _options) {
    this.locations.push(location)
  }

  visitStarted(visit) {
    this.locations.push(visit.location)
    visit.cancel()
  }

  visitCompleted(_visit) {}

  visitFailed(_visit) {}

  visitRequestStarted(_visit) {}

  visitRequestCompleted(_visit) {}

  visitRequestFailedWithStatusCode(_visit, _statusCode) {}

  visitRequestFinished(_visit) {}

  visitRendered(_visit) {}

  formSubmissionStarted(_formSubmission) {}

  formSubmissionFinished(_formSubmission) {}

  pageInvalidated() {}
}

let adapter

setup(() => {
  adapter = new DeprecatedAdapterSupportTest()
  Turbo.registerAdapter(adapter)
})

teardown(() => {
  // Clean up any test resources if needed
})

suite('Deprecated Adapter Support', () => {
  test("visit proposal location includes deprecated absoluteURL property", async () => {
    Turbo.navigator.proposeVisit(new URL(window.location.toString()))
    assert.equal(adapter.locations.length, 1)

    const [location] = adapter.locations
    assert.equal(location.toString(), location.absoluteURL)
  })

  test("visit started location includes deprecated absoluteURL property", async () => {
    Turbo.visit(window.location.toString())
    assert.equal(adapter.locations.length, 1)

    const [location] = adapter.locations
    assert.equal(location.toString(), location.absoluteURL)
  })
})
