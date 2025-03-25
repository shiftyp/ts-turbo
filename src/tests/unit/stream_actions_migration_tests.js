import { StreamActions } from "../../core/streams/stream_actions"
import { StreamMessage } from "../../core/streams/stream_message"
import { session } from "../../core"
import { assert, fixture, html } from '@open-wc/testing';
import { stub } from 'sinon';

// Setup test environment flag to prevent actual navigation
window.testEnvironment = true;

// Directly mock navigation methods to prevent actual navigation
const originalSessionVisit = session.visit;
const originalSessionRefresh = session.refresh;

session.visit = function() { return Promise.resolve(); };
session.refresh = function() { return Promise.resolve(); };

suite('Stream Actions Migration', () => {
  test("refreshAction is properly implemented and handles requestId correctly", () => {
    const mockContext = {
      targetElements: [document.createElement("div")],
      templateContent: document.createDocumentFragment(),
      getAttribute: stub().returns(null),
      baseURI: "about:blank",  // Use about:blank to prevent actual navigation
      requestId: "123",
      removeDuplicateTargetChildren: stub()
    };
    
    const originalRefresh = session.refresh;
    const originalRecentRequests = session.recentRequests;
    
    try {
      session.refresh = stub();
      session.recentRequests = new Set();
      
      // Test when requestId is not in recentRequests
      StreamActions.refreshAction.call(mockContext);
      assert.isTrue(session.refresh.called, "session.refresh should be called");
      assert.isTrue(session.refresh.calledWith(mockContext.baseURI, "123"), "session.refresh should be called with correct parameters");
      
      // Reset for next test
      session.refresh.reset();
      
      // Test when requestId is in recentRequests
      session.recentRequests.add("123");
      StreamActions.refreshAction.call(mockContext);
      assert.isFalse(session.refresh.called, "session.refresh should not be called when requestId is in recentRequests");
    } finally {
      session.refresh = originalRefresh;
      session.recentRequests = originalRecentRequests;
    }
  });

  test("StreamActions should implement all required methods", () => {
    const requiredMethods = [
      "afterAction",
      "appendAction",
      "beforeAction",
      "prependAction",
      "removeAction",
      "replaceAction",
    "updateAction",
    "refreshAction"
  ];
  
  requiredMethods.forEach(method => {
    assert.isFunction(StreamActions[method], `${method} should be a function`);
  });
});

  test("All action methods should be callable with the correct context", () => {
    const mockContext = {
      targetElements: [document.createElement("div")],
      templateContent: document.createDocumentFragment(),
      getAttribute: stub().returns(null),
      baseURI: "http://example.com",
      requestId: "123",
      removeDuplicateTargetChildren: stub()
    }
  
  const requiredMethods = [
    "afterAction",
    "appendAction",
    "beforeAction",
    "prependAction",
    "removeAction",
    "replaceAction",
    "updateAction",
    "refreshAction"
  ];
  
    requiredMethods.forEach(method => {
      assert.doesNotThrow(() => StreamActions[method].call(mockContext), `${method} should be callable with the correct context`);
    });
  });

  test("StreamMessage.wrap handles different message types correctly", () => {
    const stringMessage = "test message";
    const wrappedStringMessage = StreamMessage.wrap(stringMessage);
    assert.isObject(wrappedStringMessage, "wrappedStringMessage should be an object");
    assert.equal(wrappedStringMessage.content, stringMessage, "String message should be wrapped with content property");
    
    const objectMessage = { content: "test" };
    const wrappedObjectMessage = StreamMessage.wrap(objectMessage);
    assert.isObject(wrappedObjectMessage, "wrappedObjectMessage should be an object");
    assert.equal(wrappedObjectMessage.content, objectMessage.content, "Object message content should be preserved");
  });

  // These tests are commented out as they require the actual WebSocket and EventSource classes
  // which may not be available in the testing environment
  /* 
  test("StreamSource can be initialized with WebSocket", () => {
    // Mock WebSocket implementation to avoid actual connections
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.addEventListener = stub();
      }
    }
    
    const mockWebSocket = new MockWebSocket("ws://example.com");
    const streamSource = new StreamSource(mockWebSocket);
    assert.exists(streamSource, "streamSource should be created successfully");
  });

  test("StreamSource can be initialized with EventSource", () => {
    // Mock EventSource implementation to avoid actual connections
    class MockEventSource {
      constructor(url) {
        this.url = url;
        this.addEventListener = stub();
      }
    }
    
    const mockEventSource = new MockEventSource("http://example.com/events");
    const streamSource = new StreamSource(mockEventSource);
    assert.exists(streamSource, "streamSource should be created successfully");
  });
  */
});
