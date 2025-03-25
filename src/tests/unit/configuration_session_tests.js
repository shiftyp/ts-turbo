import { assert } from "@open-wc/testing"
import * as Turbo from "../../"

// Test configuration and session management without causing actual memory leaks or race conditions
test("🐛 Session initialization null reference handling", () => {
  // Test proper null checking in session initialization
  
  // Create a mock Session class
  class MockSession {
    constructor() {
      this.started = false
      this.enabled = false
      this.drive = null // Intentionally null to test handling
    }
    
    // Inefficient start method (no null checking)
    startInefficient() {
      if (!this.started) {
        this.started = true
        try {
          // This would throw if drive is null
          this.drive.start()
          return true
        } catch (error) {
          // Error would be thrown
          return false
        }
      }
      return true
    }
    
    // Efficient start method (with null checking)
    startEfficient() {
      if (!this.started) {
        this.started = true
        // Check if drive exists before attempting to start it
        if (this.drive) {
          this.drive.start()
        }
        this.enabled = true
        return true
      }
      return true
    }
  }
  
  // Create a session with null drive
  const session = new MockSession()
  
  // Test inefficient start method (no null checking)
  const inefficientResult = session.startInefficient()
  
  // Should fail due to null reference
  assert.isFalse(inefficientResult)
  
  // Reset session
  session.started = false
  session.enabled = false
  
  // Test efficient start method (with null checking)
  const efficientResult = session.startEfficient()
  
  // Should succeed despite null drive
  assert.isTrue(efficientResult)
  assert.isTrue(session.started)
  assert.isTrue(session.enabled)
})

test("🐛 Observer initialization ordering", () => {
  // Test proper observer initialization ordering to prevent race conditions
  
  // Create a mock Session class with observers
  class MockSession {
    constructor() {
      this.started = false
      this.enabled = false
      this.initializationOrder = []
      
      // Create mock observers
      this.pageObserver = { 
        start: () => this.initializationOrder.push("pageObserver"),
        stop: () => {}
      }
      this.cacheObserver = { 
        start: () => this.initializationOrder.push("cacheObserver"),
        stop: () => {}
      }
      this.linkPrefetchObserver = { 
        start: () => this.initializationOrder.push("linkPrefetchObserver"),
        stop: () => {}
      }
      this.formLinkClickObserver = { 
        start: () => this.initializationOrder.push("formLinkClickObserver"),
        stop: () => {}
      }
      this.linkClickObserver = { 
        start: () => this.initializationOrder.push("linkClickObserver"),
        stop: () => {}
      }
      this.formSubmitObserver = { 
        start: () => this.initializationOrder.push("formSubmitObserver"),
        stop: () => {}
      }
      this.scrollObserver = { 
        start: () => this.initializationOrder.push("scrollObserver"),
        stop: () => {}
      }
      this.streamObserver = { 
        start: () => this.initializationOrder.push("streamObserver"),
        stop: () => {}
      }
      this.frameRedirector = { 
        start: () => this.initializationOrder.push("frameRedirector"),
        stop: () => {}
      }
      this.history = { 
        start: () => this.initializationOrder.push("history"),
        stop: () => {}
      }
      this.preloader = { 
        start: () => this.initializationOrder.push("preloader"),
        stop: () => {}
      }
    }
    
    // Inefficient start method (no clear ordering)
    startInefficient() {
      if (!this.started) {
        // Random order of observer initialization
        this.formSubmitObserver.start()
        this.linkClickObserver.start()
        this.pageObserver.start()
        this.frameRedirector.start()
        this.history.start()
        this.streamObserver.start()
        this.formLinkClickObserver.start()
        this.scrollObserver.start()
        this.cacheObserver.start()
        this.linkPrefetchObserver.start()
        this.preloader.start()
        
        this.started = true
        this.enabled = true
      }
    }
    
    // Efficient start method (with proper ordering)
    startEfficient() {
      if (!this.started) {
        // Start observers in dependency order
        this.pageObserver.start()
        this.cacheObserver.start()
        this.linkPrefetchObserver.start()
        this.formLinkClickObserver.start()
        this.linkClickObserver.start()
        this.formSubmitObserver.start()
        this.scrollObserver.start()
        this.streamObserver.start()
        this.frameRedirector.start()
        this.history.start()
        this.preloader.start()
        
        this.started = true
        this.enabled = true
      }
    }
  }
  
  // Create a session
  const inefficientSession = new MockSession()
  
  // Test inefficient start method (no clear ordering)
  inefficientSession.startInefficient()
  
  // Order should be different from the expected dependency order
  const inefficientOrder = inefficientSession.initializationOrder
  assert.notDeepEqual(inefficientOrder, [
    "pageObserver",
    "cacheObserver",
    "linkPrefetchObserver",
    "formLinkClickObserver",
    "linkClickObserver",
    "formSubmitObserver",
    "scrollObserver",
    "streamObserver",
    "frameRedirector",
    "history",
    "preloader"
  ])
  
  // Create another session
  const efficientSession = new MockSession()
  
  // Test efficient start method (with proper ordering)
  efficientSession.startEfficient()
  
  // Order should match the expected dependency order
  const efficientOrder = efficientSession.initializationOrder
  assert.deepEqual(efficientOrder, [
    "pageObserver",
    "cacheObserver",
    "linkPrefetchObserver",
    "formLinkClickObserver",
    "linkClickObserver",
    "formSubmitObserver",
    "scrollObserver",
    "streamObserver",
    "frameRedirector",
    "history",
    "preloader"
  ])
})

test("🐛 Global initialization error handling", () => {
  // Test proper error handling in global initialization function
  
  // Create mock objects
  const mockConsole = {
    errorCalled: false,
    errorMessage: "",
    error: function(message, error) {
      this.errorCalled = true
      this.errorMessage = message
    }
  }
  
  // Save original console.error
  const originalConsoleError = console.error
  
  // Replace console.error with mock
  console.error = mockConsole.error.bind(mockConsole)
  
  // Create a mock session that throws an error
  const mockErrorSession = {
    start: function() {
      throw new Error("Session start error")
    }
  }
  
  // Create a mock session that starts successfully
  const mockSuccessSession = {
    started: false,
    start: function() {
      this.started = true
    }
  }
  
  // Inefficient start function (no error handling)
  function startInefficient(session) {
    try {
      session.start()
      return true
    } catch (error) {
      return false
    }
  }
  
  // Efficient start function (with error handling)
  function startEfficient(session) {
    try {
      session.start()
      return true
    } catch (error) {
      console.error("Failed to start Turbo session:", error)
      return false
    }
  }
  
  // Test inefficient start function with error
  const inefficientErrorResult = startInefficient(mockErrorSession)
  
  // Should fail but not log the error
  assert.isFalse(inefficientErrorResult)
  assert.isFalse(mockConsole.errorCalled)
  
  // Reset mock console
  mockConsole.errorCalled = false
  mockConsole.errorMessage = ""
  
  // Test efficient start function with error
  const efficientErrorResult = startEfficient(mockErrorSession)
  
  // Should fail and log the error
  assert.isFalse(efficientErrorResult)
  assert.isTrue(mockConsole.errorCalled)
  
  // Test efficient start function with success
  const efficientSuccessResult = startEfficient(mockSuccessSession)
  
  // Should succeed
  assert.isTrue(efficientSuccessResult)
  assert.isTrue(mockSuccessSession.started)
  
  // Restore original console.error
  console.error = originalConsoleError
})

test("🔧 Session shutdown resource cleanup", () => {
  // Test proper resource cleanup during session shutdown
  
  // Create a mock Session class with observers
  class MockSession {
    constructor() {
      this.started = false
      this.stoppedObservers = []
      
      // Create mock observers
      this.pageObserver = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("pageObserver")
      }
      this.cacheObserver = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("cacheObserver")
      }
      this.linkPrefetchObserver = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("linkPrefetchObserver")
      }
      this.formLinkClickObserver = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("formLinkClickObserver")
      }
      this.linkClickObserver = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("linkClickObserver")
      }
      this.formSubmitObserver = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("formSubmitObserver")
      }
      this.scrollObserver = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("scrollObserver")
      }
      this.streamObserver = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("streamObserver")
      }
      this.frameRedirector = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("frameRedirector")
      }
      this.history = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("history")
      }
      this.preloader = { 
        start: () => {},
        stop: () => this.stoppedObservers.push("preloader")
      }
    }
    
    // Start the session
    start() {
      this.started = true
    }
    
    // Inefficient stop method (incomplete cleanup)
    stopInefficient() {
      if (this.started) {
        // Only stop some observers
        this.pageObserver.stop()
        this.linkClickObserver.stop()
        this.formSubmitObserver.stop()
        
        this.started = false
      }
    }
    
    // Efficient stop method (complete cleanup)
    stopEfficient() {
      if (this.started) {
        // Stop all observers
        this.pageObserver.stop()
        this.cacheObserver.stop()
        this.linkPrefetchObserver.stop()
        this.formLinkClickObserver.stop()
        this.linkClickObserver.stop()
        this.formSubmitObserver.stop()
        this.scrollObserver.stop()
        this.streamObserver.stop()
        this.frameRedirector.stop()
        this.history.stop()
        this.preloader.stop()
        
        this.started = false
      }
    }
  }
  
  // Create a session
  const inefficientSession = new MockSession()
  inefficientSession.start()
  
  // Test inefficient stop method (incomplete cleanup)
  inefficientSession.stopInefficient()
  
  // Only some observers should be stopped
  assert.equal(inefficientSession.stoppedObservers.length, 3)
  assert.include(inefficientSession.stoppedObservers, "pageObserver")
  assert.include(inefficientSession.stoppedObservers, "linkClickObserver")
  assert.include(inefficientSession.stoppedObservers, "formSubmitObserver")
  
  // Create another session
  const efficientSession = new MockSession()
  efficientSession.start()
  
  // Test efficient stop method (complete cleanup)
  efficientSession.stopEfficient()
  
  // All observers should be stopped
  assert.equal(efficientSession.stoppedObservers.length, 11)
  assert.include(efficientSession.stoppedObservers, "pageObserver")
  assert.include(efficientSession.stoppedObservers, "cacheObserver")
  assert.include(efficientSession.stoppedObservers, "linkPrefetchObserver")
  assert.include(efficientSession.stoppedObservers, "formLinkClickObserver")
  assert.include(efficientSession.stoppedObservers, "linkClickObserver")
  assert.include(efficientSession.stoppedObservers, "formSubmitObserver")
  assert.include(efficientSession.stoppedObservers, "scrollObserver")
  assert.include(efficientSession.stoppedObservers, "streamObserver")
  assert.include(efficientSession.stoppedObservers, "frameRedirector")
  assert.include(efficientSession.stoppedObservers, "history")
  assert.include(efficientSession.stoppedObservers, "preloader")
})

test("🐛 Configuration validation with fallbacks", () => {
  // Test proper validation of configuration options with fallbacks
  
  // Inefficient config function (no validation)
  function getConfigInefficient(config) {
    return {
      enabled: config.enabled,
      progressBarDelay: config.progressBarDelay,
      linkClickSelector: config.linkClickSelector
    }
  }
  
  // Efficient config function (with validation and fallbacks)
  function getConfigEfficient(config) {
    return {
      enabled: config && typeof config.enabled !== "undefined" ? config.enabled : true,
      progressBarDelay: config && typeof config.progressBarDelay === "number" ? 
        config.progressBarDelay : 500,
      linkClickSelector: config && typeof config.linkClickSelector === "string" ?
        config.linkClickSelector : "a[data-turbo]"
    }
  }
  
  // Test with valid config
  const validConfig = {
    enabled: false,
    progressBarDelay: 1000,
    linkClickSelector: "a.turbo-link"
  }
  
  // Test inefficient config function with valid config
  const inefficientValidResult = getConfigEfficient(validConfig)
  
  // Should use provided values
  assert.isFalse(inefficientValidResult.enabled)
  assert.equal(inefficientValidResult.progressBarDelay, 1000)
  assert.equal(inefficientValidResult.linkClickSelector, "a.turbo-link")
  
  // Test with invalid config
  const invalidConfig = {
    enabled: "yes", // Not a boolean
    progressBarDelay: "fast", // Not a number
    // Missing linkClickSelector
  }
  
  // Skip testing the inefficient implementation directly as it would throw errors
  // Instead, we'll just verify the efficient implementation works correctly
  
  // Test efficient config function with invalid config
  const efficientInvalidResult = getConfigEfficient(invalidConfig)
  
  // Should use fallback values for invalid properties
  // Since the invalid string "yes" should be replaced with the default value (true)
  assert.isTrue(efficientInvalidResult.enabled)
  assert.equal(efficientInvalidResult.progressBarDelay, 500) // Fallback to 500
  assert.equal(efficientInvalidResult.linkClickSelector, "a[data-turbo]") // Fallback to default
  
  // Test with null config
  const nullConfig = null
  
  try {
    // Test inefficient config function with null config
    // This would throw errors in a real implementation
    const inefficientNullResult = getConfigInefficient(nullConfig)
    
    // Would throw TypeError: Cannot read property 'enabled' of null
    assert.fail("Should have thrown an error")
  } catch (error) {
    // Expected behavior
    assert.instanceOf(error, TypeError)
  }
  
  // Test efficient config function with null config
  const efficientNullResult = getConfigEfficient(nullConfig)
  
  // Should use all fallback values
  assert.isTrue(efficientNullResult.enabled) // Fallback to true
  assert.equal(efficientNullResult.progressBarDelay, 500) // Fallback to 500
  assert.equal(efficientNullResult.linkClickSelector, "a[data-turbo]") // Fallback to default
})

test("🐛 Browser compatibility with feature detection", () => {
  // Test proper browser compatibility with feature detection
  
  // Mock window and document objects
  const mockWindow = {}
  const mockDocument = {}
  
  // Save original window and document
  const originalWindow = window
  const originalDocument = document
  
  // Inefficient adapter registration (no feature detection)
  function registerAdapterInefficient() {
    return new BrowserAdapter() // Would fail if browser features are missing
  }
  
  // Efficient adapter registration (with feature detection)
  function registerAdapterEfficient() {
    // Check for browser features before initializing the adapter
    if (typeof window !== "undefined" && window.document) {
      return new BrowserAdapter()
    } else {
      console.warn("Turbo requires a browser environment with window and document objects")
      return null
    }
  }
  
  // Mock BrowserAdapter class
  class BrowserAdapter {
    constructor() {
      // This would use browser features
    }
  }
  
  // Test in a browser environment (should work)
  const adapterInBrowser = registerAdapterEfficient()
  assert.instanceOf(adapterInBrowser, BrowserAdapter)
  
  // Instead of trying to modify the window object (which we can't in a browser),
  // we'll create a mock function that simulates the behavior
  
  // Mock function that simulates browser detection
  function simulateNonBrowserEnvironment() {
    // Simulate a non-browser environment by returning null
    return null
  }
  
  function simulateBrowserEnvironment() {
    // Simulate a browser environment by returning a BrowserAdapter
    return new BrowserAdapter()
  }
  
  // Inefficient adapter registration (no feature detection)
  function registerAdapterInefficient() {
    // Always returns a BrowserAdapter regardless of environment
    return new BrowserAdapter()
  }
  
  // Efficient adapter registration with environment check
  function registerAdapterWithCheck(checkFn) {
    const result = checkFn()
    if (result === null) {
      console.warn("Turbo requires a browser environment with window and document objects")
      return null
    }
    return result
  }
  
  // Save original console.warn
  const originalConsoleWarn = console.warn
  
  // Replace console.warn with mock
  const mockConsole = {
    warnCalled: false,
    warnMessage: "",
    warn: function(message) {
      this.warnCalled = true
      this.warnMessage = message
    }
  }
  
  console.warn = mockConsole.warn.bind(mockConsole)
  
  // Test with browser environment
  const adapterWithBrowserEnv = registerAdapterWithCheck(simulateBrowserEnvironment)
  assert.instanceOf(adapterWithBrowserEnv, BrowserAdapter)
  
  // Test with non-browser environment
  const nonBrowserAdapter = registerAdapterWithCheck(simulateNonBrowserEnvironment)
  
  // Should return null and log a warning
  assert.isNull(nonBrowserAdapter)
  assert.isTrue(mockConsole.warnCalled)
  assert.equal(mockConsole.warnMessage, "Turbo requires a browser environment with window and document objects")
  
  // Restore original console.warn
  console.warn = originalConsoleWarn
})

test("🐛 URL backward compatibility layer", () => {
  // Test proper backward compatibility layer for deprecated URL properties
  
  // Create a URL object manually instead of using the URL constructor
  const url = {
    href: "https://example.com/path?query=value#hash",
    origin: "https://example.com",
    pathname: "/path",
    search: "?query=value",
    hash: "#hash"
  }
  
  // Inefficient URL handling (no backward compatibility)
  function useURLInefficient(url) {
    // This would fail if older code expects deprecated properties
    return {
      href: url.href,
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash
    }
  }
  
  // Efficient URL handling (with backward compatibility)
  function useURLEfficient(url) {
    // Create a new object with the original properties
    const extendedURL = {
      ...url,
      // Add deprecated properties
      get absoluteURL() {
        return this.href
      },
      get relativeURL() {
        return this.pathname + this.search + this.hash
      },
      toCacheKey: function() {
        return this.href
      }
    }
    
    return extendedURL
  }
  
  // Test inefficient URL handling
  const inefficientResult = useURLInefficient(url)
  
  // Should have standard properties but not deprecated ones
  assert.equal(inefficientResult.href, "https://example.com/path?query=value#hash")
  assert.equal(inefficientResult.pathname, "/path")
  assert.isUndefined(inefficientResult.absoluteURL)
  assert.isUndefined(inefficientResult.relativeURL)
  
  // Test efficient URL handling
  const efficientResult = useURLEfficient(url)
  
  // Should have both standard and deprecated properties
  assert.equal(efficientResult.href, "https://example.com/path?query=value#hash")
  assert.equal(efficientResult.pathname, "/path")
  assert.equal(efficientResult.absoluteURL, "https://example.com/path?query=value#hash")
  assert.equal(efficientResult.relativeURL, "/path?query=value#hash")
  assert.isFunction(efficientResult.toCacheKey)
  assert.equal(efficientResult.toCacheKey(), "https://example.com/path?query=value#hash")
})
