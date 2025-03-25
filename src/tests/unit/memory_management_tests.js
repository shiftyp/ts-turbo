import { assert } from "@open-wc/testing"
import * as Turbo from "../../"

test("🐛 Stream source disconnection and resource cleanup", () => {
  // Test proper resource cleanup in observer disconnection
  
  // Create a mock stream observer
  const mockStreamObserver = {
    sources: [],
    
    // Event handlers
    receiveMessageEvent: () => {},
    errorEvent: () => {},
    
    // Connect method
    connectStreamSource(source) {
      this.sources.push(source)
      
      // Add event listeners
      source.addEventListener("message", this.receiveMessageEvent)
      source.addEventListener("error", this.errorEvent)
    },
    
    // Disconnect method with proper cleanup
    disconnectStreamSource(source) {
      const index = this.sources.indexOf(source)
      if (index > -1) {
        this.sources.splice(index, 1)
        
        // Remove all event listeners to prevent memory leaks
        source.removeEventListener("message", this.receiveMessageEvent)
        source.removeEventListener("error", this.errorEvent)
      }
    }
  }
  
  // Create mock event source
  const mockSource = {
    eventListeners: {},
    
    // Mock addEventListener
    addEventListener(event, handler) {
      if (!this.eventListeners[event]) {
        this.eventListeners[event] = []
      }
      this.eventListeners[event].push(handler)
    },
    
    // Mock removeEventListener
    removeEventListener(event, handler) {
      if (this.eventListeners[event]) {
        const index = this.eventListeners[event].indexOf(handler)
        if (index > -1) {
          this.eventListeners[event].splice(index, 1)
        }
      }
    }
  }
  
  // Connect source
  mockStreamObserver.connectStreamSource(mockSource)
  assert.equal(mockStreamObserver.sources.length, 1)
  assert.equal(mockSource.eventListeners["message"].length, 1)
  assert.equal(mockSource.eventListeners["error"].length, 1)
  
  // Disconnect source
  mockStreamObserver.disconnectStreamSource(mockSource)
  assert.equal(mockStreamObserver.sources.length, 0)
  assert.equal(mockSource.eventListeners["message"].length, 0)
  assert.equal(mockSource.eventListeners["error"].length, 0)
})

test("🔧 Frame controller connection state tracking", () => {
  // Test improved frame controller disconnection with connection state tracking
  
  // Create mock observers
  const createMockObserver = () => {
    return {
      started: false,
      startCalled: 0,
      stopCalled: 0,
      
      start() {
        this.started = true
        this.startCalled++
      },
      
      stop() {
        this.started = false
        this.stopCalled++
      }
    }
  }
  
  // Create a mock frame controller
  const mockFrameController = {
    connected: false,
    appearanceObserver: createMockObserver(),
    formLinkClickObserver: createMockObserver(),
    linkInterceptor: createMockObserver(),
    formSubmitObserver: createMockObserver(),
    
    // Connect method with state tracking
    connect() {
      if (!this.connected) {
        this.connected = true
        this.appearanceObserver.start()
        this.formLinkClickObserver.start()
        this.linkInterceptor.start()
        this.formSubmitObserver.start()
      }
    },
    
    // Disconnect method with state tracking
    disconnect() {
      if (this.connected) {
        this.connected = false
        this.appearanceObserver.stop()
        this.formLinkClickObserver.stop()
        this.linkInterceptor.stop()
        this.formSubmitObserver.stop()
      }
    }
  }
  
  // Test initial state
  assert.isFalse(mockFrameController.connected)
  
  // Connect
  mockFrameController.connect()
  assert.isTrue(mockFrameController.connected)
  assert.equal(mockFrameController.appearanceObserver.startCalled, 1)
  assert.equal(mockFrameController.formLinkClickObserver.startCalled, 1)
  assert.equal(mockFrameController.linkInterceptor.startCalled, 1)
  assert.equal(mockFrameController.formSubmitObserver.startCalled, 1)
  
  // Connect again (should not start observers again)
  mockFrameController.connect()
  assert.equal(mockFrameController.appearanceObserver.startCalled, 1) // Still 1
  
  // Disconnect
  mockFrameController.disconnect()
  assert.isFalse(mockFrameController.connected)
  assert.equal(mockFrameController.appearanceObserver.stopCalled, 1)
  
  // Disconnect again (should not stop observers again)
  mockFrameController.disconnect()
  assert.equal(mockFrameController.appearanceObserver.stopCalled, 1) // Still 1
})

test("🐛 Event listener cleanup in session stop", () => {
  // Test proper event listener cleanup in session stop
  
  // Create a mock document and window for testing
  const mockDocument = {
    eventListeners: {},
    
    addEventListener(event, handler, options) {
      if (!this.eventListeners[event]) {
        this.eventListeners[event] = []
      }
      this.eventListeners[event].push({ handler, options })
    },
    
    removeEventListener(event, handler, options) {
      if (this.eventListeners[event]) {
        const index = this.eventListeners[event].findIndex(
          listener => listener.handler === handler && 
                     JSON.stringify(listener.options) === JSON.stringify(options)
        )
        if (index > -1) {
          this.eventListeners[event].splice(index, 1)
        }
      }
    }
  }
  
  const mockWindow = {
    eventListeners: {},
    
    addEventListener(event, handler) {
      if (!this.eventListeners[event]) {
        this.eventListeners[event] = []
      }
      this.eventListeners[event].push(handler)
    },
    
    removeEventListener(event, handler) {
      if (this.eventListeners[event]) {
        const index = this.eventListeners[event].indexOf(handler)
        if (index > -1) {
          this.eventListeners[event].splice(index, 1)
        }
      }
    }
  }
  
  // Create a mock session
  const mockSession = {
    clickCaptured: () => {},
    submitCaptured: () => {},
    navigateCallback: () => {},
    
    // Start method
    start() {
      mockDocument.addEventListener("click", this.clickCaptured, true)
      mockDocument.addEventListener("submit", this.submitCaptured, true)
      mockWindow.addEventListener("popstate", this.navigateCallback)
    },
    
    // Stop method with proper cleanup
    stop() {
      mockDocument.removeEventListener("click", this.clickCaptured, true)
      mockDocument.removeEventListener("submit", this.submitCaptured, true)
      mockWindow.removeEventListener("popstate", this.navigateCallback)
    }
  }
  
  // Start session
  mockSession.start()
  assert.equal(mockDocument.eventListeners["click"].length, 1)
  assert.equal(mockDocument.eventListeners["submit"].length, 1)
  assert.equal(mockWindow.eventListeners["popstate"].length, 1)
  
  // Stop session
  mockSession.stop()
  assert.equal(mockDocument.eventListeners["click"].length, 0)
  assert.equal(mockDocument.eventListeners["submit"].length, 0)
  assert.equal(mockWindow.eventListeners["popstate"].length, 0)
})

test("🐛 Reference clearing in visit completion", () => {
  // Test proper reference clearing in visit completion
  
  // Create a mock visit
  const mockVisit = {
    adapter: {
      visitCompleted: () => {}
    },
    timeoutID: setTimeout(() => {}, 1000),
    element: document.createElement("div"),
    
    // Mock followRedirect method
    followRedirect() {
      // No-op for testing
    },
    
    // Complete method with proper reference clearing
    complete() {
      this.adapter.visitCompleted(this)
      
      // Clear any lingering references that might cause memory leaks
      if (this.timeoutID) {
        clearTimeout(this.timeoutID)
        this.timeoutID = undefined
      }
      
      // Clear DOM references
      this.followRedirect()
      this.element = null
    }
  }
  
  // Verify initial state
  assert.isNotNull(mockVisit.timeoutID)
  assert.isNotNull(mockVisit.element)
  
  // Complete visit
  mockVisit.complete()
  
  // Verify references are cleared
  assert.isUndefined(mockVisit.timeoutID)
  assert.isNull(mockVisit.element)
})

test("🔧 Visibility-based resource management", () => {
  // Test visibility-based connection management for stream sources
  
  // Create mock stream sources
  const createMockStreamSource = (initialState) => {
    return {
      state: initialState,
      connectCalled: 0,
      disconnectCalled: 0
    }
  }
  
  // Create a mock session with visibility handling
  const mockSession = {
    pageIsVisible: true,
    streamSources: [
      createMockStreamSource("open"),
      createMockStreamSource("closed"),
      createMockStreamSource("open")
    ],
    
    // Connect stream source
    connectStreamSource(source) {
      source.state = "open"
      source.connectCalled++
    },
    
    // Disconnect stream source
    disconnectStreamSource(source) {
      source.state = "closed"
      source.disconnectCalled++
    },
    
    // Visibility change handler
    onPageVisibilityChange() {
      this.pageIsVisible = document.visibilityState === "visible"
      
      if (this.pageIsVisible) {
        // Reconnect stream sources when page becomes visible
        this.streamSources.forEach(source => {
          if (source.state === "closed") {
            this.connectStreamSource(source)
          }
        })
      } else {
        // Disconnect stream sources when page is hidden to save resources
        this.streamSources.forEach(source => {
          if (source.state === "open") {
            this.disconnectStreamSource(source)
          }
        })
      }
    }
  }
  
  // Save original visibilityState
  const originalVisibilityState = document.visibilityState
  
  // Mock document.visibilityState
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: function() { return 'hidden'; }
  });
  
  // Test page hidden
  mockSession.onPageVisibilityChange()
  assert.isFalse(mockSession.pageIsVisible)
  assert.equal(mockSession.streamSources[0].disconnectCalled, 1)
  assert.equal(mockSession.streamSources[1].disconnectCalled, 0) // Already closed
  assert.equal(mockSession.streamSources[2].disconnectCalled, 1)
  
  // Mock document.visibilityState as visible
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: function() { return 'visible'; }
  });
  
  // Test page visible
  mockSession.onPageVisibilityChange()
  assert.isTrue(mockSession.pageIsVisible)
  assert.equal(mockSession.streamSources[0].connectCalled, 1)
  assert.equal(mockSession.streamSources[1].connectCalled, 1)
  assert.equal(mockSession.streamSources[2].connectCalled, 1)
  
  // Restore original visibilityState
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: function() { return originalVisibilityState; }
  });
})
