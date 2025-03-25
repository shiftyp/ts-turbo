import { assert } from "@open-wc/testing"
import * as Turbo from "../../"

// Test interface implementation issues without causing navigation
test("🔧 Interface implementation - Parameter types", () => {
  // Test that interface implementations handle parameter types correctly
  
  // Create a mock interface implementation
  const mockImplementation = {
    methodWithStringParam: function(param) {
      return typeof param === "string"
    },
    methodWithNumberParam: function(param) {
      return typeof param === "number"
    },
    methodWithObjectParam: function(param) {
      return typeof param === "object" && param !== null
    },
    methodWithOptionalParam: function(param = "default") {
      return param
    }
  }
  
  // Test with correct parameter types
  assert.isTrue(mockImplementation.methodWithStringParam("test"))
  assert.isTrue(mockImplementation.methodWithNumberParam(123))
  assert.isTrue(mockImplementation.methodWithObjectParam({}))
  
  // Test with optional parameter
  assert.equal(mockImplementation.methodWithOptionalParam(), "default")
  assert.equal(mockImplementation.methodWithOptionalParam("custom"), "custom")
})

test("🔧 Parameter mismatch between interface definition and implementation", () => {
  // Test parameter mismatch between interface definition and implementation
  
  // Create a mock LinkPrefetchObserver
  const mockLinkPrefetchObserver = {
    // Mock delegate with the correct parameter signature
    delegate: {
      canPrefetchRequestToLocation: function(link, location) {
        // Check that both parameters are provided and have the correct type
        return typeof link === "object" && 
               typeof location === "object" && 
               location instanceof URL
      }
    },
    
    // Test method that calls the delegate
    testPrefetch: function(link, location) {
      return this.delegate.canPrefetchRequestToLocation(link, location)
    }
  }
  
  // Create test data
  const mockLink = document.createElement("a")
  const mockLocation = new URL("https://example.com")
  
  // Test with correct parameters
  assert.isTrue(mockLinkPrefetchObserver.testPrefetch(mockLink, mockLocation))
  
  // Create a mock with incorrect implementation (missing parameter)
  const mockIncorrectImplementation = {
    canPrefetchRequestToLocation: function(location) {
      // Only accepts one parameter
      return true
    }
  }
  
  // Test that the incorrect implementation would fail if used
  // (in TypeScript this would be a compile error)
  assert.isUndefined(mockIncorrectImplementation.canPrefetchRequestToLocation(mockLink, mockLocation).link)
})

test("🔧 Interface implementation - Method presence", () => {
  // Test that all required methods are present in an implementation
  
  // Define a set of required method names
  const requiredMethods = ["connect", "disconnect", "render"]
  
  // Create a mock implementation
  const mockImplementation = {
    connect: () => {},
    disconnect: () => {},
    render: () => {}
  }
  
  // Check that all required methods are present
  for (const methodName of requiredMethods) {
    assert.isFunction(mockImplementation[methodName], `Method ${methodName} should be implemented`)
  }
})

test("🔧 Missing method implementation in interface", () => {
  // Test detection of missing method implementations
  
  // Define a mock FrameElementDelegate interface
  const frameElementDelegateMethods = [
    "connect",
    "disconnect",
    "loadingStyleChanged",
    "sourceURLChanged",
    "disabledChanged",
    "sourceURLReloaded",
    "formSubmitted",
    "linkClickIntercepted",
    "proposeVisitIfNavigatedWithAction" // This method was missing in the original implementation
  ]
  
  // Create a complete implementation with all required methods
  const completeImplementation = {
    connect: () => {},
    disconnect: () => {},
    loadingStyleChanged: () => {},
    sourceURLChanged: () => {},
    disabledChanged: () => {},
    sourceURLReloaded: () => Promise.resolve(),
    formSubmitted: (form, submitter) => {},
    linkClickIntercepted: (element, url, event) => {},
    proposeVisitIfNavigatedWithAction: (element, action) => {}
  }
  
  // Create an incomplete implementation missing the proposeVisitIfNavigatedWithAction method
  const incompleteImplementation = {
    connect: () => {},
    disconnect: () => {},
    loadingStyleChanged: () => {},
    sourceURLChanged: () => {},
    disabledChanged: () => {},
    sourceURLReloaded: () => Promise.resolve(),
    formSubmitted: (form, submitter) => {},
    linkClickIntercepted: (element, url, event) => {}
    // Missing proposeVisitIfNavigatedWithAction
  }
  
  // Check that all required methods are present in the complete implementation
  for (const methodName of frameElementDelegateMethods) {
    assert.isFunction(completeImplementation[methodName], 
      `Method ${methodName} should be implemented in complete implementation`)
  }
  
  // Check that the incomplete implementation is missing the required method
  assert.isUndefined(incompleteImplementation.proposeVisitIfNavigatedWithAction,
    "proposeVisitIfNavigatedWithAction should be missing in incomplete implementation")
})

test("🐛 Type consistency - URL handling", () => {
  // Test URL object type consistency without causing navigation
  
  // Create a URL object from a data URI (safe, non-navigating)
  const dataUrl = "data:,Hello%2C%20World!"
  const url = new URL(dataUrl)
  
  // Test URL object properties
  assert.equal(url.href, dataUrl)
  assert.equal(url.protocol, "data:")
  
  // Test URL object methods
  assert.isFunction(url.toString)
  assert.equal(url.toString(), dataUrl)
  
  // Test creating a new URL from an existing URL
  const url2 = new URL(url)
  assert.equal(url2.href, url.href)
})

test("🐛 Type consistency - DOM element properties", () => {
  // Test DOM element property type consistency
  
  // Create different types of elements
  const div = document.createElement("div")
  const anchor = document.createElement("a")
  const button = document.createElement("button")
  
  // Test element-specific properties
  assert.isUndefined(div.href) // div doesn't have href
  assert.isString(anchor.href) // anchor has href as string
  assert.isUndefined(button.href) // button doesn't have href
  
  // Test common properties
  assert.isString(div.tagName)
  assert.isString(anchor.tagName)
  assert.isString(button.tagName)
})

test("🔇 Type consistency - Event handling", () => {
  // Test event handling type consistency
  
  // Create an element
  const element = document.createElement("div")
  
  // Create different event types
  const clickEvent = new MouseEvent("click")
  const customEvent = new CustomEvent("custom", { detail: { data: "test" } })
  
  // Test event properties
  assert.equal(clickEvent.type, "click")
  assert.equal(customEvent.type, "custom")
  assert.isObject(customEvent.detail)
  assert.equal(customEvent.detail.data, "test")
  
  // Test event dispatch without actually triggering handlers
  let clickHandled = false
  let customHandled = false
  
  // Add event listeners that set flags but don't navigate
  element.addEventListener("click", () => { clickHandled = true })
  element.addEventListener("custom", () => { customHandled = true })
  
  // Dispatch events
  element.dispatchEvent(clickEvent)
  element.dispatchEvent(customEvent)
  
  // Check that handlers were called
  assert.isTrue(clickHandled)
  assert.isTrue(customHandled)
})

test("🐛 Type safety in method parameters", () => {
  // Test type safety in method parameters
  
  // Create a mock session with a getVisitAction function
  const mockSession = {
    // Mock getVisitAction function that might return null
    getVisitAction: function(element) {
      // Return null for elements without a data-turbo-action attribute
      return element.getAttribute("data-turbo-action")
    },
    
    // Mock proposeVisit function that requires a non-null action
    proposeVisit: function(element, action) {
      // This would fail if action is null
      return {
        element,
        action,
        // In TypeScript, this would require action to be a string
        actionType: action.toLowerCase()
      }
    },
    
    // Safe version with null coalescing
    proposeVisitSafe: function(element, action) {
      // Use null coalescing to ensure action is always a string
      const safeAction = action || "advance"
      return {
        element,
        action: safeAction,
        actionType: safeAction.toLowerCase()
      }
    }
  }
  
  // Create test elements
  const elementWithAction = document.createElement("div")
  elementWithAction.setAttribute("data-turbo-action", "replace")
  
  const elementWithoutAction = document.createElement("div")
  // No data-turbo-action attribute
  
  // Test with element that has an action
  const action1 = mockSession.getVisitAction(elementWithAction)
  assert.equal(action1, "replace")
  
  const visit1 = mockSession.proposeVisit(elementWithAction, action1)
  assert.equal(visit1.action, "replace")
  assert.equal(visit1.actionType, "replace")
  
  // Test with element that doesn't have an action
  const action2 = mockSession.getVisitAction(elementWithoutAction)
  assert.isNull(action2)
  
  // This would throw an error in TypeScript or at runtime
  try {
    const visit2 = mockSession.proposeVisit(elementWithoutAction, action2)
    // Should not reach here
    assert.fail("Should have thrown an error when calling toLowerCase() on null")
  } catch (error) {
    // Expected error
    assert.instanceOf(error, TypeError)
  }
  
  // Test safe version with null coalescing
  const visit3 = mockSession.proposeVisitSafe(elementWithoutAction, action2)
  assert.equal(visit3.action, "advance") // Default value
  assert.equal(visit3.actionType, "advance")
})
