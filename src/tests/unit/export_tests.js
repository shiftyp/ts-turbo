import { assert } from "@open-wc/testing"
import * as Turbo from "../../"
import { StreamActions } from "../../"

test("Turbo interface", () => {
  assert.equal(typeof Turbo.StreamActions, "object")
  assert.equal(typeof Turbo.start, "function")
  assert.equal(typeof Turbo.registerAdapter, "function")
  assert.equal(typeof Turbo.visit, "function")
  assert.equal(typeof Turbo.connectStreamSource, "function")
  assert.equal(typeof Turbo.disconnectStreamSource, "function")
  assert.equal(typeof Turbo.renderStreamMessage, "function")
  assert.equal(typeof Turbo.clearCache, "function")
  assert.equal(typeof Turbo.setProgressBarDelay, "function")
  assert.equal(typeof Turbo.setConfirmMethod, "function")
  assert.equal(typeof Turbo.setFormMode, "function")
  assert.equal(typeof Turbo.cache, "object")
  assert.equal(typeof Turbo.config, "object")
  assert.equal(typeof Turbo.cache.clear, "function")
  assert.equal(typeof Turbo.navigator, "object")
  assert.equal(typeof Turbo.session, "object")
  assert.equal(typeof Turbo.session.drive, "boolean")
  assert.equal(typeof Turbo.session.formMode, "string")
  assert.equal(typeof Turbo.fetch, "function")
})

test("Session interface", () => {
  const { session, config } = Turbo

  assert.equal(true, session.drive)
  assert.equal(true, config.drive.enabled)
  assert.equal("turbo", session.formMode)
  assert.equal("turbo", config.forms.formMode)
  assert.equal(true, config.forms.submitSelector.includes("form[data-turbo='true']"))
  assert.equal(false, config.forms.submitSelector.includes("form[data-turbo='false']"))
  assert.equal(true, config.forms.submitterSelector.includes("button"))
  assert.equal(true, config.forms.submitterSelector.includes("input[type=submit]"))
  assert.equal(true, config.forms.submitterSelector.includes("input[type=image]"))
})

test("StreamActions interface", () => {
  assert.equal(StreamActions.after, "after")
  assert.equal(StreamActions.append, "append")
  assert.equal(StreamActions.before, "before")
  assert.equal(StreamActions.prepend, "prepend")
  assert.equal(StreamActions.remove, "remove")
  assert.equal(StreamActions.replace, "replace")
  assert.equal(StreamActions.update, "update")
})
