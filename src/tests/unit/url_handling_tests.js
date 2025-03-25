import { urlsAreEqual } from "../../core/url"
import { assert, fixture, html, oneEvent } from '@open-wc/testing';

suite("URL Comparison", () => {
  test("urlsAreEqual handles different URL types correctly", () => {
    const urlString = "https://example.com"
    const urlObject = new URL("https://example.com")
    
    assert.isTrue(urlsAreEqual(urlString, urlObject), "urlsAreEqual should return true for equal string and URL object")
    assert.isTrue(urlsAreEqual(urlObject, urlString), "urlsAreEqual should return true for equal URL object and string")
    
    const differentUrlString = "https://example.org"
    assert.isFalse(urlsAreEqual(urlString, differentUrlString), "urlsAreEqual should return false for different URLs")
  });
  
  test("urlsAreEqual safely handles null and undefined values", () => {
    // Test with null/undefined
    assert.isFalse(urlsAreEqual(null, "https://example.com"), "url and null should not be equal")
    assert.isFalse(urlsAreEqual("https://example.com", null), "url and null should not be equal")
    assert.isTrue(urlsAreEqual(null, null), "null and null should be equal")
    assert.isFalse(urlsAreEqual(undefined, "https://example.com"), "url and undefined should not be equal")
    assert.isFalse(urlsAreEqual("https://example.com", undefined), "url and undefined should not be equal")
    assert.isTrue(urlsAreEqual(undefined, undefined), "undefined and undefined should be equal")
    assert.isFalse(urlsAreEqual(null, undefined), "null and undefined should not be equal")
  });
  
  test("urlsAreEqual handles query parameters and hash fragments", () => {
    // Test with query parameters
    assert.isTrue(urlsAreEqual("https://example.com?a=1", "https://example.com?a=1"), "same query params should be equal")
    assert.isFalse(urlsAreEqual("https://example.com?a=1", "https://example.com?a=2"), "different query params should not be equal")
    assert.isTrue(urlsAreEqual("https://example.com?a=1&b=2", "https://example.com?b=2&a=1"), "query params in different order should be equal")
    
    // Test with hash fragments
    assert.isTrue(urlsAreEqual("https://example.com#section1", "https://example.com#section1"), "same hash should be equal")
    assert.isFalse(urlsAreEqual("https://example.com#section1", "https://example.com#section2"), "different hash should not be equal")
    
    // Test with both query parameters and hash fragments
    assert.isTrue(urlsAreEqual("https://example.com?a=1#section1", "https://example.com?a=1#section1"), "same query and hash should be equal")
    assert.isFalse(urlsAreEqual("https://example.com?a=1#section1", "https://example.com?a=1#section2"), "different hash should not be equal")
  });
});
