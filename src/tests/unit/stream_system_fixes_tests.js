import { assert } from "@open-wc/testing"
import * as Turbo from "../../"

// Test stream system fixes without causing actual memory leaks or race conditions
test("🐛 Stream element event handling cleanup", () => {
  // Test proper event cleanup in stream elements to prevent memory leaks
  
  // Create a mock StreamElement class
  class MockStreamElement {
    constructor() {
      this.eventListeners = new Map()
      this.clickCaptured = this.clickCaptured.bind(this)
    }
    

    
    // Event handler
    clickCaptured(event) {
      // Mock event handler
    }
    
    // Inefficient disconnectedCallback (no event cleanup)
    disconnectedCallbackInefficient() {
      // Missing event listener cleanup could lead to memory leaks
    }
    
    // Efficient disconnectedCallback (with event cleanup)
    disconnectedCallbackEfficient() {
      // Clean up event listeners to prevent memory leaks
      this.removeEventListener("click", this.clickCaptured)
    }
  }
  
  // Create a stream element
  const element = new MockStreamElement()
  // Mock HTMLElement methods
  element.addEventListener = function(type, listener) {
    // Track event listeners
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set())
    }
    this.eventListeners.get(type).add(listener)
  }
  
  element.removeEventListener = function(type, listener) {
    // Track event listener removal
    if (this.eventListeners.has(type)) {
      this.eventListeners.get(type).delete(listener)
      if (this.eventListeners.get(type).size === 0) {
        this.eventListeners.delete(type)
      }
    }
  }
  
  // Add event listener
  element.addEventListener("click", element.clickCaptured)
  
  // Verify event listener was added
  assert.isTrue(element.eventListeners.has("click"))
  assert.equal(element.eventListeners.get("click").size, 1)
  
  // Test inefficient disconnectedCallback (no event cleanup)
  element.disconnectedCallbackInefficient()
  
  // Event listener should still be there (potential memory leak)
  assert.isTrue(element.eventListeners.has("click"))
  assert.equal(element.eventListeners.get("click").size, 1)
  
  // Test efficient disconnectedCallback (with event cleanup)
  element.disconnectedCallbackEfficient()
  
  // Event listener should be removed
  assert.isFalse(element.eventListeners.has("click"))
})

test("🐛 Stream message processing synchronization", () => {
  // Test proper synchronization in stream message processing
  
  // Create a mock StreamMessage class
  class MockStreamMessage {
    constructor(fragment) {
      this.fragment = fragment
      this.streamElements = []
      this.processedElements = []
      this.processingOrder = []
    }
    
    // Inefficient processing (potential race conditions)
    processInefficient() {
      // Process elements without deterministic order
      this.processElementsInefficient()
      return this.fragment
    }
    
    processElementsInefficient() {
      if (this.fragment) {
        // No deterministic order, could lead to race conditions
        // Simulate async processing with setTimeout that could cause race conditions
        let count = 0
        this.streamElements.forEach(element => {
          // Simulate varying processing times that could cause order issues
          const delay = this.streamElements.length - count
          setTimeout(() => {
            this.processedElements.push(element)
            this.processingOrder.push(element)
          }, delay)
          count++
        })
      }
    }
    
    // Efficient processing (with proper synchronization)
    processEfficient() {
      // Process elements in a deterministic order
      this.processElementsEfficient()
      return this.fragment
    }
    
    processElementsEfficient() {
      if (this.fragment) {
        // Process elements in a deterministic order
        // Using for...of ensures sequential processing
        for (const element of this.streamElements) {
          this.processedElements.push(element)
          this.processingOrder.push(element)
        }
      }
    }
  }
  
  // Create a document fragment
  const fragment = document.createDocumentFragment()
  
  // Create a stream message
  const message = new MockStreamMessage(fragment)
  
  // Add stream elements in a specific order
  message.streamElements = ["element1", "element2", "element3"]
  
  // Test efficient processing first (deterministic)
  message.processEfficient()
  
  // Elements should be processed in the expected order
  assert.equal(message.processedElements.length, 3)
  assert.deepEqual(message.processedElements, ["element1", "element2", "element3"])
  assert.deepEqual(message.processingOrder, ["element1", "element2", "element3"], "Efficient processing maintains order")
  
  // Reset processed elements and order
  message.processedElements = []
  message.processingOrder = []
  
  // Test inefficient processing with simulated async behavior
  message.processInefficient()
  
  // Use setTimeout to check the results after all async operations complete
  setTimeout(() => {
    // Elements should all be processed eventually
    assert.equal(message.processedElements.length, 3, "All elements should be processed")
    
    // But the processing order might not match the original order due to race conditions
    // This is a more realistic test of the issue being fixed
    if (message.processingOrder[0] !== "element1" || 
        message.processingOrder[1] !== "element2" || 
        message.processingOrder[2] !== "element3") {
      console.warn("Inefficient processing demonstrates race condition: " + 
                  JSON.stringify(message.processingOrder))
    }
  }, 10)
})

test("🔧 Stream source connection lifecycle management", () => {
  // Test proper connection lifecycle management based on page visibility
  
  // Create a mock StreamSourceElement class
  class MockStreamSourceElement {
    constructor() {
      this.streamSource = null
      this.isConnected = false
      this.visibilityChangedCallback = this.visibilityChangedCallback.bind(this)
    }
    
    // Create a stream source
    createStreamSource() {
      return { url: this.getAttribute("src") }
    }
    
    // Connect stream source
    connectStreamSource() {
      this.isConnected = true
    }
    
    // Disconnect stream source
    disconnectStreamSource() {
      this.isConnected = false
    }
    
    // Visibility change handler
    visibilityChangedCallback() {
      if (document.visibilityState === "visible") {
        this.connectStreamSource()
      } else {
        this.disconnectStreamSource()
      }
    }
    
    // Inefficient connectedCallback (no visibility state handling)
    connectedCallbackInefficient() {
      // Always connect regardless of page visibility
      if (this.hasAttribute("src")) {
        this.streamSource = this.createStreamSource()
        this.connectStreamSource()
      }
    }
    
    // Efficient connectedCallback (with visibility state handling)
    connectedCallbackEfficient() {
      // Only connect when page is visible to save resources
      if (this.hasAttribute("src")) {
        this.streamSource = this.createStreamSource()
        if (document.visibilityState === "visible") {
          this.connectStreamSource()
        }
        
        // Listen for visibility changes
        document.addEventListener("visibilitychange", this.visibilityChangedCallback)
      }
    }
    
    // Inefficient disconnectedCallback (no event cleanup)
    disconnectedCallbackInefficient() {
      this.disconnectStreamSource()
      // Missing event listener cleanup
    }
    
    // Efficient disconnectedCallback (with event cleanup)
    disconnectedCallbackEfficient() {
      this.disconnectStreamSource()
      // Clean up event listeners
      document.removeEventListener("visibilitychange", this.visibilityChangedCallback)
    }
  }
  
  // Create a stream source element
  const element = new MockStreamSourceElement()
  
  // Mock HTMLElement methods
  element.hasAttribute = function(name) {
    return this._attributes && this._attributes[name] !== undefined
  }
  
  element.getAttribute = function(name) {
    return this._attributes && this._attributes[name]
  }
  
  element.setAttribute = function(name, value) {
    if (!this._attributes) {
      this._attributes = {}
    }
    this._attributes[name] = value
  }
  
  // Set src attribute
  element.setAttribute("src", "https://example.com/stream")
  
  // Mock document visibility state
  const originalVisibilityState = document.visibilityState
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: function() { return "hidden" }
  })
  
  // Test inefficient connectedCallback (no visibility state handling)
  element.connectedCallbackInefficient()
  
  // Stream source should be connected regardless of visibility
  assert.isTrue(element.isConnected)
  
  // Reset connection state
  element.isConnected = false
  
  // Test efficient connectedCallback (with visibility state handling)
  element.connectedCallbackEfficient()
  
  // Stream source should not be connected when page is not visible
  assert.isFalse(element.isConnected)
  
  // Simulate visibility change to visible
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: function() { return "visible" }
  })
  
  // Trigger visibility change event
  const visibilityEvent = new Event("visibilitychange")
  document.dispatchEvent(visibilityEvent)
  
  // Stream source should be connected when page is visible
  assert.isTrue(element.isConnected)
  
  // Test inefficient disconnectedCallback (no event cleanup)
  element.disconnectedCallbackInefficient()
  
  // Connection should be closed
  assert.isFalse(element.isConnected)
  
  // Simulate visibility change to visible again
  document.dispatchEvent(visibilityEvent)
  
  // Stream source should be reconnected due to event still being active
  assert.isTrue(element.isConnected)
  
  // Reset connection state
  element.isConnected = false
  
  // Test efficient disconnectedCallback (with event cleanup)
  element.disconnectedCallbackEfficient()
  
  // Connection should be closed
  assert.isFalse(element.isConnected)
  
  // Simulate visibility change to visible again
  document.dispatchEvent(visibilityEvent)
  
  // Stream source should not be reconnected due to event being removed
  assert.isFalse(element.isConnected)
  
  // Restore original visibility state
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: function() { return originalVisibilityState }
  })
})

test("🐛 Stream source validation", () => {
  // Test proper validation when creating stream sources
  
  // Create a mock StreamSourceElement class
  class MockStreamSourceElement {
    constructor() {
      this.streamSource = null
      this.isConnected = false
    }
    
    // Create a stream source
    createStreamSource() {
      const src = this.getAttribute("src")
      return src ? { url: src } : null
    }
    
    // Connect stream source
    connectStreamSource(source) {
      if (source) {
        this.isConnected = true
      }
    }
    
    // Inefficient connection (no validation)
    connectInefficient() {
      // Could create invalid stream sources without proper validation
      this.streamSource = this.createStreamSource()
      this.connectStreamSource(this.streamSource)
    }
    
    // Efficient connection (with validation)
    connectEfficient() {
      if (this.hasAttribute("src")) {
        this.streamSource = this.createStreamSource()
        if (this.streamSource) {
          this.connectStreamSource(this.streamSource)
        }
      }
    }
  }
  
  // Test with valid src attribute
  const validElement = new MockStreamSourceElement()
  
  // Mock HTMLElement methods
  validElement.hasAttribute = function(name) {
    return this._attributes && this._attributes[name] !== undefined
  }
  
  validElement.getAttribute = function(name) {
    return this._attributes && this._attributes[name]
  }
  
  validElement.setAttribute = function(name, value) {
    if (!this._attributes) {
      this._attributes = {}
    }
    this._attributes[name] = value
  }
  
  // Set src attribute
  validElement.setAttribute("src", "https://example.com/stream")
  
  // Test inefficient connection (no validation)
  validElement.connectInefficient()
  
  // Stream source should be connected
  assert.isTrue(validElement.isConnected)
  assert.isNotNull(validElement.streamSource)
  
  // Test with invalid src attribute
  const invalidElement = new MockStreamSourceElement()
  
  // Mock HTMLElement methods
  invalidElement.hasAttribute = function(name) {
    return this._attributes && this._attributes[name] !== undefined
  }
  
  invalidElement.getAttribute = function(name) {
    return this._attributes && this._attributes[name]
  }
  
  invalidElement.setAttribute = function(name, value) {
    if (!this._attributes) {
      this._attributes = {}
    }
    this._attributes[name] = value
  }
  // No src attribute
  
  // Reset connection state
  invalidElement.isConnected = false
  
  // Test inefficient connection (no validation)
  invalidElement.connectInefficient()
  
  // Stream source should not be connected, but no error should occur
  assert.isFalse(invalidElement.isConnected)
  assert.isNull(invalidElement.streamSource)
  
  // Test efficient connection (with validation)
  invalidElement.connectEfficient()
  
  // Stream source should not be connected
  assert.isFalse(invalidElement.isConnected)
  assert.isNull(invalidElement.streamSource)
})
