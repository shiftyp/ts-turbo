import { urlsAreEqual } from "../../core/url"
import { fetch as fetchWithTurboHeaders, recentRequests } from "../../http/fetch"
import { assert, fixture, html, oneEvent } from '@open-wc/testing';

suite("URL Handling Tests", () => {

test("urlsAreEqual handles different URL types correctly", () => {
  const urlString = "https://example.com"
  const urlObject = new URL("https://example.com")
  
  assert.isTrue(urlsAreEqual(urlString, urlObject), "urlsAreEqual should return true for equal string and URL object")
  assert.isTrue(urlsAreEqual(urlObject, urlString), "urlsAreEqual should return true for equal URL object and string")
  
  const differentUrlString = "https://example.org"
  assert.isFalse(urlsAreEqual(urlString, differentUrlString), "urlsAreEqual should return false for different URLs")
});

test("fetchWithTurboHeaders adds X-Turbo-Request-Id header", async () => {
  // Create a spy on window.fetch to capture the actual request
  const originalFetch = window.fetch;
  let capturedOptions;
  
  try {
    window.fetch = (url, options) => {
      capturedOptions = options;
      return Promise.resolve(new Response());
    };
    
    // Clear recent requests before test
    recentRequests.clear();
    
    // Call the function to test
    await fetchWithTurboHeaders("https://example.com");
    
    // Verify headers
    assert.isDefined(capturedOptions, "Fetch options should be captured");
    assert.isDefined(capturedOptions.headers, "Headers should be defined");
    
    // Check if X-Turbo-Request-Id was added
    const modifiedHeaders = capturedOptions.headers;
    assert.isTrue(modifiedHeaders.has("X-Turbo-Request-Id"), "X-Turbo-Request-Id header should be present");
    
    // Check if the request ID was added to recentRequests
    assert.equal(recentRequests.size, 1, "Request should be added to recentRequests");
  } finally {
    // Restore original fetch
    window.fetch = originalFetch;
  }
});

});
