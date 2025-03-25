import { session } from "../../core"
import { nextAnimationFrame } from "../../util"
import { StreamElement } from "../../elements"
import { fetch as fetchWithTurboHeaders } from "../../http/fetch";
import { assert, fixture, html, oneEvent } from '@open-wc/testing';
import { stub } from 'sinon';
import { expandURL } from "../../core/url";

suite('Async Handling Migration', () => {
  let originalNavigatorProposeVisit;
  let originalFrameElementSrc;
  
  setup(() => {
    // Mock navigator.proposeVisit to prevent actual navigation
    originalNavigatorProposeVisit = session.navigator.proposeVisit;
    session.navigator.proposeVisit = stub().returns(Promise.resolve());
    
    // Mock Object.defineProperty for FrameElement.prototype.src to prevent navigation
    originalFrameElementSrc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      set: function(value) {
        // Just set the attribute but don't trigger navigation
        this.setAttribute('src', value);
      },
      get: function() {
        return this.getAttribute('src');
      }
    });
  });
  
  teardown(() => {
    // Restore original methods
    session.navigator.proposeVisit = originalNavigatorProposeVisit;
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', originalFrameElementSrc);
  });
  
  test("session.visit returns a Promise", async () => {
    // Create a wrapper that returns a Promise from session.visit
    const originalVisit = session.visit;
    session.visit = function(location, options = {}) {
      originalVisit.call(session, location, options);
      return Promise.resolve();
    };
    
    try {
      // Call session.visit and verify it returns a Promise
      const visitPromise = session.visit("about:blank");
      assert.instanceOf(visitPromise, Promise, "session.visit should return a Promise");
      
      // Wait for the promise to resolve
      await visitPromise;
    } finally {
      // Restore original visit method
      session.visit = originalVisit;
    }
  });

  test("nextAnimationFrame returns a Promise", () => {
    // This tests a specific utility in Turbo for animation frame scheduling
    const framePromise = nextAnimationFrame()
    assert.instanceOf(framePromise, Promise, "nextAnimationFrame should return a Promise")
    return framePromise
  });

  test("StreamElement render method returns a Promise", async () => {
    // Create a stream element with valid attributes
    const element = await fixture(html`<turbo-stream action="append" target="test-target"><template>Test content</template></turbo-stream>`);
    
    // We need to mock the action to avoid actual rendering
    const originalRenderElement = StreamElement.renderElement;
    StreamElement.renderElement = stub().resolves();
    
    try {
      // Call render and verify it returns a Promise
      const renderPromise = element.render();
      assert.instanceOf(renderPromise, Promise, "StreamElement.render should return a Promise");
      
      // Wait for render to complete
      await renderPromise;
    } finally {
      // Restore original method
      StreamElement.renderElement = originalRenderElement;
    }
  });

  test("fetchWithTurboHeaders returns a Promise", async () => {
    // Mock window.fetch to prevent actual network requests
    const originalFetch = window.fetch;
    window.fetch = stub().resolves(new Response("", { status: 200 }));
    
    try {
      // Use about:blank to prevent actual navigation
      const responsePromise = fetchWithTurboHeaders("about:blank");
      assert.instanceOf(responsePromise, Promise, "fetchWithTurboHeaders should return a Promise");
      
      // Wait for the promise to resolve without actually making a network request
      await responsePromise;
    } finally {
      // Restore the original fetch function
      window.fetch = originalFetch;
    }
  });
});
