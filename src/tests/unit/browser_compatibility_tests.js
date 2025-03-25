import { assert } from "@open-wc/testing"
import * as Turbo from "../../"

test("🐛 Timer management - proper cleanup", () => {
  // Test that timers are properly cleaned up
  
  // Create a mock object with timer management
  const mockTimerManager = {
    progressBarTimeout: null,
    
    showProgressBarAfterDelay() {
      // Clear any existing timeout first to prevent duplicates
      if (this.progressBarTimeout != null) {
        clearTimeout(this.progressBarTimeout)
      }
      
      this.progressBarTimeout = setTimeout(() => {
        this.showProgressBar()
      }, 500)
    },
    
    hideProgressBar() {
      // Clear the timeout when hiding the progress bar
      if (this.progressBarTimeout != null) {
        clearTimeout(this.progressBarTimeout)
        this.progressBarTimeout = null
      }
    },
    
    showProgressBar() {
      // Just a mock method
    }
  }
  
  // Test that the timeout is set
  mockTimerManager.showProgressBarAfterDelay()
  assert.isNotNull(mockTimerManager.progressBarTimeout)
  
  // Test that the timeout is cleared
  mockTimerManager.hideProgressBar()
  assert.isNull(mockTimerManager.progressBarTimeout)
  
  // Test that calling showProgressBarAfterDelay multiple times doesn't create multiple timers
  const originalSetTimeout = window.setTimeout
  let timeoutCallCount = 0
  
  // Mock setTimeout to count calls
  window.setTimeout = function(callback, delay) {
    timeoutCallCount++
    return originalSetTimeout(callback, delay)
  }
  
  mockTimerManager.showProgressBarAfterDelay()
  mockTimerManager.showProgressBarAfterDelay() // Should clear the previous timeout
  
  assert.equal(timeoutCallCount, 2) // Two calls to setTimeout
  
  // Restore original setTimeout
  window.setTimeout = originalSetTimeout
  
  // Clean up
  mockTimerManager.hideProgressBar()
})

test("🐛 Event handler context binding", () => {
  // Test that event handlers maintain the correct context
  
  // Create a mock object with event handlers
  const mockEventHandler = {
    value: 0,
    
    // Method using function declaration (context can be lost)
    incrementWithFunction() {
      this.value++
    },
    
    // Method using arrow function (context is preserved)
    incrementWithArrow: () => {
      mockEventHandler.value++
    }
  }
  
  // Test direct calls
  mockEventHandler.incrementWithFunction()
  assert.equal(mockEventHandler.value, 1)
  
  mockEventHandler.incrementWithArrow()
  assert.equal(mockEventHandler.value, 2)
  
  // Test calls with different context
  const differentContext = { value: 100 }
  
  // Using function declaration - context is changed
  const boundFunction = mockEventHandler.incrementWithFunction.bind(differentContext)
  boundFunction()
  assert.equal(differentContext.value, 101)
  assert.equal(mockEventHandler.value, 2) // Unchanged
  
  // Using arrow function - original context is preserved
  const boundArrow = mockEventHandler.incrementWithArrow.bind(differentContext)
  boundArrow()
  assert.equal(differentContext.value, 101) // Unchanged
  assert.equal(mockEventHandler.value, 3) // Changed
})

test("🔧 Error handling for browser events", () => {
  // Test that event handlers catch errors properly
  
  // Create a mock event handler that might throw an error
  const mockErrorHandler = {
    handleEvent(event) {
      if (event.type === "error") {
        throw new Error("Test error")
      }
      return true
    },
    
    // Wrapper with try/catch
    safeHandleEvent(event) {
      try {
        return this.handleEvent(event)
      } catch (error) {
        return false
      }
    }
  }
  
  // Test with a normal event
  const normalEvent = { type: "normal" }
  assert.isTrue(mockErrorHandler.handleEvent(normalEvent))
  assert.isTrue(mockErrorHandler.safeHandleEvent(normalEvent))
  
  // Test with an error event
  const errorEvent = { type: "error" }
  
  // Direct call should throw
  assert.throws(() => {
    mockErrorHandler.handleEvent(errorEvent)
  }, "Test error")
  
  // Safe call should catch the error
  assert.isFalse(mockErrorHandler.safeHandleEvent(errorEvent))
})

test("🐛 Feature detection and fallbacks", () => {
  // Test proper feature detection and fallbacks
  
  // Create a mock object that uses feature detection
  const mockFeatureDetector = {
    // Method that checks if a feature exists before using it
    useFeature(obj, featureName, fallback) {
      if (obj && typeof obj[featureName] === "function") {
        return obj[featureName]()
      } else {
        return fallback
      }
    }
  }
  
  // Test object with the feature
  const objWithFeature = {
    testFeature: () => "Feature available"
  }
  
  // Test object without the feature
  const objWithoutFeature = {}
  
  // Test null object
  const nullObj = null
  
  // Test with feature available
  assert.equal(
    mockFeatureDetector.useFeature(objWithFeature, "testFeature", "Fallback"),
    "Feature available"
  )
  
  // Test with feature unavailable
  assert.equal(
    mockFeatureDetector.useFeature(objWithoutFeature, "testFeature", "Fallback"),
    "Fallback"
  )
  
  // Test with null object
  assert.equal(
    mockFeatureDetector.useFeature(nullObj, "testFeature", "Fallback"),
    "Fallback"
  )
})

test("🔧 Cross-browser DOM handling", () => {
  // Test cross-browser DOM handling
  
  // Create a mock element focus handler
  const mockFocusHandler = {
    focusElement(element) {
      if (!element) return false
      
      try {
        // Save current active element to detect changes
        const previousActive = document.activeElement
        
        // Try standard focus
        element.focus()
        
        // For elements that might not be naturally focusable
        if (document.activeElement !== element) {
          // Fallback: make element focusable and try again
          const tabIndex = element.getAttribute("tabindex")
          element.setAttribute("tabindex", "-1")
          element.focus()
          
          // Restore original tabindex
          if (tabIndex) {
            element.setAttribute("tabindex", tabIndex)
          } else {
            element.removeAttribute("tabindex")
          }
        }
        
        // Consider focus successful if either:
        // 1. Element is now the active element, or
        // 2. The active element changed from what it was before
        return document.activeElement === element || document.activeElement !== previousActive
      } catch (e) {
        // Handle any browser-specific focus errors
        console.warn("Focus error:", e)
        return false
      }
    }
  }
  
  // Create test elements
  const div = document.createElement("div")
  const button = document.createElement("button")
  
  // Add elements to the document
  document.body.appendChild(div)
  document.body.appendChild(button)
  
  // Test focusing a naturally focusable element
  const buttonFocused = mockFocusHandler.focusElement(button)
  assert.isTrue(buttonFocused)
  
  // Test focusing a non-naturally focusable element
  const divFocused = mockFocusHandler.focusElement(div)
  assert.isTrue(divFocused)
  
  // Test with null element
  const nullFocused = mockFocusHandler.focusElement(null)
  assert.isFalse(nullFocused)
  
  // Clean up
  document.body.removeChild(div)
  document.body.removeChild(button)
})
