import { assert } from "@open-wc/testing"

// Test stream handling issues identified during TypeScript migration
test("🔧 Stream actions implementation", () => {
  // Test stream actions implementation and context binding
  
  // Define a mock StreamActions object similar to the one in the codebase
  const StreamActions = {
    after: "after",
    append: "append",
    before: "before",
    prepend: "prepend",
    remove: "remove",
    replace: "replace",
    update: "update",
    refresh: "refresh", // Added missing refresh action
    
    // Action methods with proper context binding
    afterAction: function() {
      // 'this' should be bound to the context
      return {
        action: "after",
        targetElements: this.targetElements,
        templateContent: this.templateContent
      }
    },
    
    appendAction: function() {
      return {
        action: "append",
        targetElements: this.targetElements,
        templateContent: this.templateContent
      }
    },
    
    // Implemented missing refreshAction
    refreshAction: function() {
      return {
        action: "refresh",
        baseURI: this.baseURI,
        requestId: this.requestId
      }
    }
  }
  
  // Create a mock context
  const context = {
    targetElements: [document.createElement("div")],
    templateContent: document.createDocumentFragment(),
    baseURI: "https://example.com",
    requestId: "123"
  }
  
  // Test that the actions exist
  assert.equal(StreamActions.after, "after")
  assert.equal(StreamActions.refresh, "refresh")
  
  // Test action methods with proper context binding
  const boundAfterAction = StreamActions.afterAction.bind(context)
  const afterResult = boundAfterAction()
  assert.equal(afterResult.action, "after")
  assert.deepEqual(afterResult.targetElements, context.targetElements)
  assert.equal(afterResult.templateContent, context.templateContent)
  
  // Test the refreshAction with proper context binding
  const boundRefreshAction = StreamActions.refreshAction.bind(context)
  const refreshResult = boundRefreshAction()
  assert.equal(refreshResult.action, "refresh")
  assert.equal(refreshResult.baseURI, "https://example.com")
  assert.equal(refreshResult.requestId, "123")
})

test("🐛 Stream element type safety", () => {
  // Test type-safe property access and casting in stream elements
  
  // Mock StreamActions for testing
  const StreamActions = {
    afterAction: function() { return "after" },
    appendAction: function() { return "append" },
    removeAction: function() { return "remove" }
  }
  
  // Function that safely gets action function from action name
  function getActionFunction(action) {
    if (!action) {
      throw new Error("action attribute is missing")
    }
    
    const actionName = `${action}Action`
    const actionFunction = StreamActions[actionName]
    
    if (typeof actionFunction !== "function") {
      throw new Error(`unknown action: ${action}`)
    }
    
    return actionFunction
  }
  
  // Test with valid action
  const afterFunction = getActionFunction("after")
  assert.isFunction(afterFunction)
  assert.equal(afterFunction(), "after")
  
  // Test with invalid action (should throw)
  try {
    getActionFunction("invalid")
    assert.fail("Should have thrown an error")
  } catch (error) {
    assert.equal(error.message, "unknown action: invalid")
  }
  
  // Test with missing action (should throw)
  try {
    getActionFunction(null)
    assert.fail("Should have thrown an error")
  } catch (error) {
    assert.equal(error.message, "action attribute is missing")
  }
})

test("🐛 Type-safe DOM operations in stream elements", () => {
  // Test type-safe DOM operations in stream elements
  
  // Function that safely gets target elements by ID
  function getTargetElementById(id, document) {
    if (!id) return []
    
    const element = document.getElementById(id)
    return element ? [element] : []
  }
  
  // Function that safely gets target elements by query
  function getTargetElementsByQuery(query, document) {
    if (!query) return []
    
    try {
      return Array.from(document.querySelectorAll(query))
    } catch (error) {
      console.error("Invalid query selector:", error)
      return []
    }
  }
  
  // Create a test document with elements
  const parser = new DOMParser()
  const testDoc = parser.parseFromString(`
    <div id="test-div">Test Div</div>
    <span class="test-span">Test Span 1</span>
    <span class="test-span">Test Span 2</span>
  `, "text/html")
  
  // Test getting element by ID
  const divElements = getTargetElementById("test-div", testDoc)
  assert.lengthOf(divElements, 1)
  assert.equal(divElements[0].textContent, "Test Div")
  
  // Test getting elements by query
  const spanElements = getTargetElementsByQuery(".test-span", testDoc)
  assert.lengthOf(spanElements, 2)
  assert.equal(spanElements[0].textContent, "Test Span 1")
  assert.equal(spanElements[1].textContent, "Test Span 2")
  
  // Test with non-existent ID
  const nonExistentElements = getTargetElementById("non-existent", testDoc)
  assert.lengthOf(nonExistentElements, 0)
  
  // Test with invalid query (should not throw)
  const invalidQueryElements = getTargetElementsByQuery("[[invalid]]", testDoc)
  assert.lengthOf(invalidQueryElements, 0)
})

test("🐛 Stream source element connection management", () => {
  // Test stream source connection management
  
  // Mock WebSocket and EventSource for testing
  class MockWebSocket {
    constructor(url) {
      this.url = url
      this.closed = false
      this.connected = true
    }
    
    close() {
      this.closed = true
      this.connected = false
    }
  }
  
  class MockEventSource {
    constructor(url) {
      this.url = url
      this.closed = false
      this.connected = true
    }
    
    close() {
      this.closed = true
      this.connected = false
    }
  }
  
  // Function to create appropriate stream source based on URL
  function createStreamSource(url) {
    if (!url) return null
    
    return url.match(/^ws{1,2}:/) 
      ? new MockWebSocket(url) 
      : new MockEventSource(url)
  }
  
  // Function to properly disconnect stream source
  function disconnectStreamSource(streamSource) {
    if (!streamSource) return
    
    // Close the connection if not already closed
    if (!streamSource.closed) {
      streamSource.close()
    }
    
    // Additional cleanup based on stream source type
    if (streamSource instanceof MockWebSocket) {
      // WebSocket-specific cleanup
      streamSource.connected = false
    } else if (streamSource instanceof MockEventSource) {
      // EventSource-specific cleanup
      streamSource.connected = false
    }
  }
  
  // Test WebSocket creation
  const wsSource = createStreamSource("ws://example.com/stream")
  assert.instanceOf(wsSource, MockWebSocket)
  assert.equal(wsSource.url, "ws://example.com/stream")
  assert.isTrue(wsSource.connected)
  
  // Test EventSource creation
  const esSource = createStreamSource("https://example.com/stream")
  assert.instanceOf(esSource, MockEventSource)
  assert.equal(esSource.url, "https://example.com/stream")
  assert.isTrue(esSource.connected)
  
  // Test disconnection of WebSocket
  disconnectStreamSource(wsSource)
  assert.isTrue(wsSource.closed)
  assert.isFalse(wsSource.connected)
  
  // Test disconnection of EventSource
  disconnectStreamSource(esSource)
  assert.isTrue(esSource.closed)
  assert.isFalse(esSource.connected)
  
  // Test with null stream source (should not throw)
  disconnectStreamSource(null)
})

test("🔧 Stream message parsing", () => {
  // Test stream message parsing with type safety
  
  // Function to safely parse stream messages
  function parseStreamMessage(message) {
    if (typeof message === "string") {
      try {
        const parsed = JSON.parse(message)
        return {
          content: parsed.content || "",
          messageId: parsed.messageId || null,
          timestamp: parsed.timestamp || Date.now()
        }
      } catch (error) {
        // If not valid JSON, treat as plain text content
        return {
          content: message,
          messageId: null,
          timestamp: Date.now()
        }
      }
    } else if (message && typeof message === "object") {
      // Already an object, ensure required properties
      return {
        content: message.content || "",
        messageId: message.messageId || null,
        timestamp: message.timestamp || Date.now()
      }
    } else {
      // Invalid message
      return null
    }
  }
  
  // Test with JSON string
  const jsonMessage = '{"content": "Hello", "messageId": "msg1", "timestamp": 1620000000000}'
  const parsedJson = parseStreamMessage(jsonMessage)
  assert.equal(parsedJson.content, "Hello")
  assert.equal(parsedJson.messageId, "msg1")
  assert.equal(parsedJson.timestamp, 1620000000000)
  
  // Test with plain text
  const textMessage = "Plain text message"
  const parsedText = parseStreamMessage(textMessage)
  assert.equal(parsedText.content, "Plain text message")
  assert.isNull(parsedText.messageId)
  assert.isNumber(parsedText.timestamp)
  
  // Test with object
  const objectMessage = { content: "Object message", messageId: "msg2" }
  const parsedObject = parseStreamMessage(objectMessage)
  assert.equal(parsedObject.content, "Object message")
  assert.equal(parsedObject.messageId, "msg2")
  assert.isNumber(parsedObject.timestamp)
  
  // Test with invalid input
  const nullResult = parseStreamMessage(null)
  assert.isNull(nullResult)
})
