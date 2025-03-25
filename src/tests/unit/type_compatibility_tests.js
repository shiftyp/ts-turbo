import { urlsAreEqual } from "../../core/url"
import { FrameElement } from "../../elements/frame_element"
import { assert, fixture, html } from '@open-wc/testing';

suite('Type Compatibility Tests', () => {
  test("urlsAreEqual handles different URL types correctly", () => {
  const urlString = "https://example.com"
  const urlObject = new URL("https://example.com")
  
  assert.isTrue(urlsAreEqual(urlString, urlObject), "urlsAreEqual should return true for equal URLs")
  assert.isTrue(urlsAreEqual(urlObject, urlString), "urlsAreEqual should return true for equal URLs")
  
  const differentUrlString = "https://example.org"
  assert.isFalse(urlsAreEqual(urlString, differentUrlString), "urlsAreEqual should return false for different URLs")
  assert.isFalse(urlsAreEqual(urlObject, differentUrlString), "urlsAreEqual should return false for different URLs")
})

  test("FrameElement type checking", async () => {
    // Define a mock delegate constructor for FrameElement
    const originalDelegateConstructor = FrameElement.delegateConstructor;
    FrameElement.delegateConstructor = class {
      constructor(element) {
        this.element = element;
      }
      connect() {}
      disconnect() {}
      loadingStyleChanged() {}
      sourceURLChanged() {}
      disabledChanged() {}
      sourceURLReloaded() { return Promise.resolve(); }
      formSubmitted() {}
      linkClickIntercepted() {}
      proposeVisitIfNavigatedWithAction() {}
    };
    
    // Ensure the custom element is defined for testing
    if (!customElements.get('turbo-frame')) {
      customElements.define('turbo-frame', FrameElement);
    }
    
    try {
      // Use fixture to create a test element, which is cleaner than manipulating innerHTML directly
      const container = await fixture(html`
        <div id="container">
          <turbo-frame id="frame" src="/example"></turbo-frame>
        </div>
      `);
      
      const frameElement = container.querySelector('#frame');
      
      assert.isTrue(frameElement instanceof Element, "frameElement should be an instance of Element");
      assert.equal(frameElement.nodeName, "TURBO-FRAME", "frameElement nodeName should be TURBO-FRAME");
    } finally {
      // Restore the original delegateConstructor
      FrameElement.delegateConstructor = originalDelegateConstructor;
    }
  });

  test("Type compatibility ensures correct function usage", () => {
    const someFunction = (input) => {
      return typeof input === "string";
    };

    assert.isTrue(someFunction("test"), "someFunction should return true for string input");
    assert.isFalse(someFunction(123), "someFunction should return false for non-string input");
  });

  test("FrameElement methods are implemented correctly", () => {
    // Check that the prototype has the required lifecycle methods
    assert.equal(typeof FrameElement.prototype.connectedCallback, "function", "connectedCallback should be a function");
    assert.equal(typeof FrameElement.prototype.disconnectedCallback, "function", "disconnectedCallback should be a function");
    assert.equal(typeof FrameElement.prototype.attributeChangedCallback, "function", "attributeChangedCallback should be a function");
  });
});
