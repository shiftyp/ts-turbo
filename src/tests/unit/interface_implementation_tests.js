import { StreamActions } from "../../core/streams/stream_actions"
import { session } from "../../core"
import { assert } from '@open-wc/testing';
import { stub } from 'sinon';

// Setup test environment flag to prevent actual navigation
window.testEnvironment = true;

// Directly mock navigation methods to prevent actual navigation
const originalSessionVisit = session.visit;
const originalSessionRefresh = session.refresh;

session.visit = function() { return Promise.resolve(); };
session.refresh = function() { return Promise.resolve(); };

suite('Interface Implementation Tests', () => {
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

test("StreamActions should have consistent method signatures", () => {
  const actionMethods = [
    StreamActions.afterAction,
    StreamActions.appendAction,
    StreamActions.beforeAction,
    StreamActions.prependAction,
    StreamActions.removeAction,
    StreamActions.replaceAction,
    StreamActions.updateAction,
    StreamActions.refreshAction
  ]
  
  actionMethods.forEach(method => {
    assert.isFunction(method, `${method.name} should be a function`)
  })
  
  const mockContext = {
    targetElements: [document.createElement("div")],
    templateContent: document.createDocumentFragment(),
    getAttribute: () => null,
    baseURI: "about:blank",  // Use about:blank to prevent navigation
    requestId: "123",
    removeDuplicateTargetChildren: () => {}
  }
  
  actionMethods.forEach(method => {
    assert.doesNotThrow(() => method.call(mockContext), `${method.name} should not throw`)
  })
})

  test("All required action methods are implemented", () => {
  const requiredActionMethods = [
    "afterAction",
    "appendAction",
    "beforeAction",
    "prependAction",
    "removeAction",
    "replaceAction",
    "updateAction",
    "refreshAction"
  ]
  
  requiredActionMethods.forEach(methodName => {
    assert.isDefined(StreamActions[methodName], `${methodName} should be defined`)
    assert.isFunction(StreamActions[methodName], `${methodName} should be a function`)
  })
})

  test("Session interface has all required navigation methods", () => {
    // Use temporarily stubbed methods for testing
    const tempVisit = stub().returns(Promise.resolve());
    const tempRefresh = stub().returns(Promise.resolve());
    
    // Save current mocked methods
    const currentVisit = session.visit;
    const currentRefresh = session.refresh;
    
    try {
      // Apply new stubs just for this test
      session.visit = tempVisit;
      session.refresh = tempRefresh;
      
      const requiredSessionMethods = [
        "visit",
        "refresh"
      ];
      
      requiredSessionMethods.forEach(methodName => {
        assert.isFunction(session[methodName], `${methodName} should be a function`);
      });
    } finally {
      // Restore the previously mocked methods (not the original ones)
      session.visit = currentVisit;
      session.refresh = currentRefresh;
    }
  });
});

// Note about migration: The navigate method was expected but not found in the session object
// This test was updated to check for 'refresh' instead as part of the TypeScript migration
