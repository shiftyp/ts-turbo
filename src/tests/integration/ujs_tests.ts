import { Page, test } from "@playwright/test"
import { assert } from "chai"
import { nextEventOnTarget, noNextEventOnTarget } from "../helpers/page"

test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/ujs.html")
})

test("allows UJS to intercept and cancel Turbo requests for anchors inside a turbo-frame", async ({ page }) => {
  await assertRequestLimit(page, 1, async () => {
    assert.equal(await page.textContent("#frame h2"), "Frames: #frame")

    await page.click("#frame a[data-remote=true]")

<<<<<<< HEAD:src/tests/integration/ujs_tests.ts
<<<<<<< HEAD:src/tests/integration/ujs_tests.ts
    assert.equal(await page.textContent("#frame"), "Content from UJS response")
    assert.ok(await noNextEventOnTarget(page, "frame", "turbo:frame-load"))
=======
    assert.ok(await noNextEventOnTarget(page, "frame", "turbo:frame-load"))
    assert.equal(await page.textContent("#frame h2"), "Frames: #frame", "does not navigate the target frame")
>>>>>>> e5e188f... `reuseExistingServer` in `CI`:src/tests/functional/ujs_tests.ts
=======
    assert.equal(await page.textContent("#frame"), "Content from UJS response")
    assert.ok(await noNextEventOnTarget(page, "frame", "turbo:frame-load"))
>>>>>>> 5a18117... Merge branch 'main' into reorganize-events:src/tests/functional/ujs_tests.ts
  })
})

test("handles [data-remote=true] forms within a turbo-frame", async ({ page }) => {
  await assertRequestLimit(page, 1, async () => {
    assert.equal(await page.textContent("#frame h2"), "Frames: #frame")

    await page.click("#frame form[data-remote=true] button")

<<<<<<< HEAD:src/tests/integration/ujs_tests.ts
<<<<<<< HEAD:src/tests/integration/ujs_tests.ts
    assert.ok(await nextEventOnTarget(page, "frame", "turbo:frame-load"))
=======
    assert.ok(await noNextEventOnTarget(page, "frame", "turbo:frame-load"))
>>>>>>> e5e188f... `reuseExistingServer` in `CI`:src/tests/functional/ujs_tests.ts
=======
    assert.ok(await nextEventOnTarget(page, "frame", "turbo:frame-load"))
>>>>>>> 5a18117... Merge branch 'main' into reorganize-events:src/tests/functional/ujs_tests.ts
    assert.equal(await page.textContent("#frame h2"), "Frame: Loaded", "navigates the target frame")
  })
})

async function assertRequestLimit(page: Page, count: number, callback: () => Promise<void>) {
  let requestsStarted = 0
  await page.on("request", () => requestsStarted++)
  await callback()

  assert.equal(requestsStarted, count, `only submits ${count} requests`)
}
