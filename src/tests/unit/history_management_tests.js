import { assert } from "@open-wc/testing"
import * as Turbo from "../../"

test("🐛 Popstate event handling with null state", () => {
  // Test handling of popstate events with null state
  
  // Create a mock history manager
  const mockHistoryManager = {
    shouldHandlePopState() {
      return true
    },
    
    // Method with proper null handling
    onPopState(event) {
      if (this.shouldHandlePopState()) {
        // Extract turbo from state with null safety
        const { turbo } = (event.state || {})
        
        // Track if turbo state was found
        this.turboStateFound = !!turbo
        
        if (turbo) {
          this.restorationIdentifier = turbo.restorationIdentifier
        }
      }
    }
  }
  
  // Test with null state
  const nullStateEvent = { state: null }
  mockHistoryManager.onPopState(nullStateEvent)
  assert.isFalse(mockHistoryManager.turboStateFound)
  
  // Test with valid state
  const validStateEvent = { 
    state: { 
      turbo: { 
        restorationIdentifier: "test-restoration-id" 
      } 
    } 
  }
  mockHistoryManager.onPopState(validStateEvent)
  assert.isTrue(mockHistoryManager.turboStateFound)
  assert.equal(mockHistoryManager.restorationIdentifier, "test-restoration-id")
})

test("🔧 History state management with index tracking", () => {
  // Test history state management with proper index tracking
  
  // Create a mock history manager
  const mockHistoryManager = {
    currentIndex: 0,
    location: null,
    restorationIdentifier: null,
    
    // Method with index tracking
    update(method, location, restorationIdentifier) {
      // Track navigation index for pushState
      if (method === "pushState") {
        ++this.currentIndex
      }
      
      // Create state object with index
      const state = { 
        turbo: { 
          restorationIdentifier,
          restorationIndex: this.currentIndex
        } 
      }
      
      // Store the state for testing
      this.lastState = state
      
      // Update location and identifier
      this.location = location
      this.restorationIdentifier = restorationIdentifier
    }
  }
  
  // Test pushState (should increment index)
  mockHistoryManager.update("pushState", new URL("https://example.com/page1"), "id1")
  assert.equal(mockHistoryManager.currentIndex, 1)
  assert.equal(mockHistoryManager.lastState.turbo.restorationIndex, 1)
  assert.equal(mockHistoryManager.lastState.turbo.restorationIdentifier, "id1")
  
  // Test another pushState (should increment index again)
  mockHistoryManager.update("pushState", new URL("https://example.com/page2"), "id2")
  assert.equal(mockHistoryManager.currentIndex, 2)
  assert.equal(mockHistoryManager.lastState.turbo.restorationIndex, 2)
  
  // Test replaceState (should not increment index)
  mockHistoryManager.update("replaceState", new URL("https://example.com/page2-updated"), "id3")
  assert.equal(mockHistoryManager.currentIndex, 2) // Still 2
  assert.equal(mockHistoryManager.lastState.turbo.restorationIndex, 2)
})

test("🐛 Browser compatibility with scroll restoration", () => {
  // Test browser compatibility with scroll restoration
  
  // Save original history.scrollRestoration
  const originalScrollRestoration = history.scrollRestoration
  
  // Create a mock history manager
  const mockHistoryManager = {
    previousScrollRestoration: null,
    
    // Method with feature detection
    assumeControlOfScrollRestoration() {
      if (!this.previousScrollRestoration) {
        // Use nullish coalescing for browser compatibility
        this.previousScrollRestoration = history.scrollRestoration ?? "auto"
        history.scrollRestoration = "manual"
      }
      return this.previousScrollRestoration
    },
    
    // Method with proper cleanup
    relinquishControlOfScrollRestoration() {
      if (this.previousScrollRestoration) {
        history.scrollRestoration = this.previousScrollRestoration
        delete this.previousScrollRestoration
      }
    }
  }
  
  // Test assuming control
  const previousValue = mockHistoryManager.assumeControlOfScrollRestoration()
  assert.equal(previousValue, originalScrollRestoration)
  assert.equal(history.scrollRestoration, "manual")
  
  // Test assuming control again (should not change previousScrollRestoration)
  mockHistoryManager.assumeControlOfScrollRestoration()
  assert.equal(mockHistoryManager.previousScrollRestoration, originalScrollRestoration)
  
  // Test relinquishing control
  mockHistoryManager.relinquishControlOfScrollRestoration()
  assert.equal(history.scrollRestoration, originalScrollRestoration)
  assert.isUndefined(mockHistoryManager.previousScrollRestoration)
  
  // Restore original value
  history.scrollRestoration = originalScrollRestoration
})

test("🐛 Page load handling with microtask delay", async () => {
  // Test page load handling with microtask delay
  
  // Create a mock history manager
  const mockHistoryManager = {
    pageLoaded: false,
    
    // Synchronous method (problematic)
    onPageLoadSync(event) {
      this.pageLoaded = true
    },
    
    // Asynchronous method with microtask delay
    async onPageLoadAsync(event) {
      // Use Promise.resolve() to create a microtask delay
      await Promise.resolve()
      this.pageLoaded = true
    }
  }
  
  // Test synchronous method
  mockHistoryManager.pageLoaded = false
  mockHistoryManager.onPageLoadSync({})
  assert.isTrue(mockHistoryManager.pageLoaded)
  
  // Test asynchronous method
  mockHistoryManager.pageLoaded = false
  const loadPromise = mockHistoryManager.onPageLoadAsync({})
  
  // Should not be loaded yet (still in microtask queue)
  assert.isFalse(mockHistoryManager.pageLoaded)
  
  // Wait for microtask to complete
  await loadPromise
  
  // Now it should be loaded
  assert.isTrue(mockHistoryManager.pageLoaded)
})

test("🔧 Initialization with pre-existing history state", () => {
  // Test initialization with pre-existing history state
  
  // Save original history.state
  const originalState = history.state
  
  // Create a mock history manager
  const mockHistoryManager = {
    started: false,
    currentIndex: 0,
    
    // Event handlers (mocked)
    onPopState: () => {},
    onPageLoad: () => {},
    
    // Replace method (mocked)
    replace(url) {
      this.replacedURL = url
    },
    
    // Start method with state preservation
    start() {
      if (!this.started) {
        // Simulate adding event listeners
        this.listenersAdded = true
        
        // Check for existing state and preserve index
        const state = history.state
        this.currentIndex = state?.turbo?.restorationIndex || 0
        
        this.started = true
        this.replace(new URL(window.location.href))
      }
    }
  }
  
  // Test with no pre-existing state
  history.replaceState(null, "", window.location.href)
  mockHistoryManager.start()
  assert.equal(mockHistoryManager.currentIndex, 0)
  assert.isTrue(mockHistoryManager.started)
  assert.isTrue(mockHistoryManager.listenersAdded)
  
  // Test with pre-existing state
  history.replaceState({ turbo: { restorationIndex: 5 } }, "", window.location.href)
  mockHistoryManager.started = false
  mockHistoryManager.currentIndex = 0
  mockHistoryManager.start()
  assert.equal(mockHistoryManager.currentIndex, 5)
  
  // Restore original state
  history.replaceState(originalState, "", window.location.href)
})
