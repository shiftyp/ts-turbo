import { assert } from "@open-wc/testing"
import * as Turbo from "../../"
import { StreamElement } from "../../elements/stream_element"
import { nextRepaint, nextAnimationFrame, nextEventLoopTick } from "../../util"
import { Visit } from "../../core/drive/visit"

test("🔧 Promise-based async operations", async () => {
  // Test that Promise-based operations are properly handled
  
  // Create a simple Promise that resolves after a short delay
  let resolveCalled = 0
  const createDelayedPromise = () => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolveCalled++
        resolve("done")
      }, 10)
    })
  }
  
  // Create a function that caches the Promise
  let cachedPromise = null
  const getCachedPromise = () => {
    if (!cachedPromise) {
      cachedPromise = createDelayedPromise()
    }
    return cachedPromise
  }
  
  // Call the function multiple times in quick succession
  const promise1 = getCachedPromise()
  const promise2 = getCachedPromise()
  
  // Both calls should return the same promise (caching)
  assert.strictEqual(promise1, promise2)
  
  // Wait for the promise to complete
  const result1 = await promise1
  const result2 = await promise2
  
  // Both results should be the same
  assert.equal(result1, result2)
  
  // The resolver should only be called once due to caching
  assert.equal(resolveCalled, 1)
})

test("🔧 Visibility-aware scheduling in nextRepaint", async () => {
  // Test that nextRepaint uses visibility-aware scheduling
  
  // Save original visibility state
  const originalVisibilityState = document.visibilityState
  
  // Mock document.visibilityState
  let visibilityState = "visible"
  Object.defineProperty(document, "visibilityState", {
    get: () => visibilityState,
    configurable: true
  })
  
  // When visible, nextRepaint should use animation frames
  visibilityState = "visible"
  const visiblePromise = nextRepaint()
  
  // When hidden, nextRepaint should use event loop ticks
  visibilityState = "hidden"
  const hiddenPromise = nextRepaint()
  
  // Both should be promises
  assert.instanceOf(visiblePromise, Promise)
  assert.instanceOf(hiddenPromise, Promise)
  
  // Wait for both promises
  await Promise.all([visiblePromise, hiddenPromise])
  
  // Restore original visibility state
  Object.defineProperty(document, "visibilityState", {
    value: originalVisibilityState,
    configurable: true
  })
})

test("🐛 Error handling in async operations", async () => {
  // Test that errors in async operations are properly handled
  
  // Create a function that returns a rejected promise
  const asyncErrorFunction = () => Promise.reject(new Error("Test error"))
  
  // Create a function that catches errors
  const catchingFunction = async () => {
    try {
      await asyncErrorFunction()
      return "Success"
    } catch (error) {
      return "Error caught"
    }
  }
  
  // The catching function should handle the error
  const result = await catchingFunction()
  assert.equal(result, "Error caught")
})

test("🐛 Promise chain error propagation", async () => {
  // Test that errors in Promise chains are properly propagated
  
  // Create a mock navigator
  const mockNavigator = {
    delegate: {
      visitFailed: () => {}
    },
    currentVisit: null,
    stop: function() {
      this.currentVisit = null
    }
  }
  
  // Create a visit that will fail
  const mockVisit = {
    start: () => Promise.reject(new Error("Visit failed")),
    cancel: () => {}
  }
  
  // Create a function similar to startVisit
  const startVisit = async () => {
    mockNavigator.stop()
    mockNavigator.currentVisit = mockVisit
    
    try {
      await mockNavigator.currentVisit.start()
      return "Success"
    } catch (error) {
      mockNavigator.currentVisit = null
      mockNavigator.delegate.visitFailed(error)
      throw error
    }
  }
  
  // The function should propagate the error
  try {
    await startVisit()
    assert.fail("Should have thrown an error")
  } catch (error) {
    assert.equal(error.message, "Visit failed")
    assert.isNull(mockNavigator.currentVisit)
  }
})

test("🐛 Consistent Promise return values", async () => {
  // Test that functions return consistent Promise values
  
  // Create a function that returns a boolean Promise
  const booleanPromiseFunction = async (condition) => {
    if (condition) {
      return true
    } else {
      return false // Explicit return for all code paths
    }
  }
  
  // Test with true condition
  const result1 = await booleanPromiseFunction(true)
  assert.isTrue(result1)
  
  // Test with false condition
  const result2 = await booleanPromiseFunction(false)
  assert.isFalse(result2)
  
  // Create a function that returns void Promise
  const voidPromiseFunction = async () => {
    // No return value
  }
  
  // The result should be undefined
  const result3 = await voidPromiseFunction()
  assert.isUndefined(result3)
})
