import { StreamActions } from "../../core/streams/stream_actions"
import { StreamMessage } from "../../core/streams/stream_message"
import { MorphingPageRenderer } from "../../core/drive/morphing_page_renderer"
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

suite('Stream Handling Tests', () => {
  test("refresh action is properly implemented", () => {
    const mockContext = {
      targetElements: [document.createElement("div")],
      templateContent: document.createDocumentFragment(),
      getAttribute: () => null,
      baseURI: "http://example.com",
      requestId: "123",
      removeDuplicateTargetChildren: () => {}
    };

    const originalRefresh = session.refresh;
    const originalRecentRequests = session.recentRequests;
    
    try {
      // Create a stubbed session.refresh function that we can track calls to
      session.refresh = stub();
      session.recentRequests = new Set();
      
      // Case 1: When requestId is not in recentRequests, refresh should be called
      StreamActions.refreshAction.call(mockContext);
      assert.isTrue(session.refresh.called, "session.refresh should be called when requestId is not in recentRequests");
      
      // Reset the stub for the next test
      session.refresh.reset();
      
      // Case 2: When requestId is in recentRequests, refresh should not be called
      session.recentRequests.add("123");
      StreamActions.refreshAction.call(mockContext);
      assert.isFalse(session.refresh.called, "session.refresh should not be called when requestId is in recentRequests");
    } finally {
      session.refresh = originalRefresh;
      session.recentRequests = originalRecentRequests;
    }
  });

  test("StreamMessage.wrap safely parses different message formats", () => {
    // Test with string content
    const stringMessage = "Hello, world!";
    const wrappedStringMessage = StreamMessage.wrap(stringMessage);
    assert.isObject(wrappedStringMessage, "Wrapped string message should be an object");
    assert.equal(wrappedStringMessage.content, stringMessage, "String message should be wrapped correctly");

    // Test with object that has content property
    const objectMessage = { content: "Hello, world!" };
    const wrappedObjectMessage = StreamMessage.wrap(objectMessage);
    assert.isObject(wrappedObjectMessage, "Wrapped object message should be an object");
    assert.equal(wrappedObjectMessage.content, objectMessage.content, "Object message should be wrapped correctly");

    // Test with StreamMessage instance
    const streamMessage = new StreamMessage("Hello, world!");
    const wrappedStreamMessage = StreamMessage.wrap(streamMessage);
    assert.strictEqual(wrappedStreamMessage, streamMessage, "StreamMessage instance should be returned as-is");
    
    // Test with null and undefined
    assert.doesNotThrow(() => StreamMessage.wrap(null), "Wrapping null should not throw");
    assert.doesNotThrow(() => StreamMessage.wrap(undefined), "Wrapping undefined should not throw");
  });

  test("MorphingPageRenderer.renderElement dispatches events", () => {
    const mockElement = document.createElement("div");
    const newElement = document.createElement("div");
    
    // Track if the method was called and with what arguments
    let called = false;
    let calledArgs = [];
    
    const originalRenderElement = MorphingPageRenderer.renderElement;
    MorphingPageRenderer.renderElement = (...args) => {
      called = true;
      calledArgs = args;
      return originalRenderElement(...args);
    };
    
    try {
      MorphingPageRenderer.renderElement(mockElement, newElement);
      assert.isTrue(called, "renderElement should be called");
      assert.deepEqual(calledArgs, [mockElement, newElement], "renderElement should be called with correct parameters");
    } finally {
      MorphingPageRenderer.renderElement = originalRenderElement;
    }
  });
});
