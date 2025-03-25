import { assert } from "@open-wc/testing"

// Test URL handling issues identified during TypeScript migration
test("🔧 Backward compatibility for deprecated URL properties", () => {
  // Test that deprecated URL properties are available for backward compatibility
  
  // Create a URL object
  const url = new URL("https://example.com/path?query=value#hash")
  
  // Test standard URL properties
  assert.equal(url.href, "https://example.com/path?query=value#hash")
  assert.equal(url.origin, "https://example.com")
  assert.equal(url.protocol, "https:")
  assert.equal(url.host, "example.com")
  assert.equal(url.pathname, "/path")
  assert.equal(url.search, "?query=value")
  assert.equal(url.hash, "#hash")
  
  // Test backward compatibility properties
  // Note: These may not exist in all browsers without the compatibility layer
  if ("absoluteURL" in url) {
    assert.equal(url.absoluteURL, url.toString())
  }
  
  // Test toString method
  assert.equal(url.toString(), "https://example.com/path?query=value#hash")
})

test("🔧 Safe URL handling with proper undefined checks", () => {
  // Test safe URL handling with proper undefined checks
  
  // Create a function that requires a URL parameter
  function processURL(url, options = {}) {
    // Safe URL handling with proper undefined checks
    const baseURL = url ? new URL(url, document.baseURI) : undefined
    const requestId = options.requestId ?? undefined
    
    // Return an object with the processed values
    return { baseURL, requestId }
  }
  
  // Test with valid URL
  const result1 = processURL("https://example.com")
  assert.instanceOf(result1.baseURL, URL)
  assert.equal(result1.baseURL.href, "https://example.com/")
  assert.isUndefined(result1.requestId)
  
  // Test with options
  const result2 = processURL("https://example.com", { requestId: "123" })
  assert.instanceOf(result2.baseURL, URL)
  assert.equal(result2.baseURL.href, "https://example.com/")
  assert.equal(result2.requestId, "123")
  
  // Test with undefined URL (should not throw)
  const result3 = processURL(undefined)
  assert.isUndefined(result3.baseURL)
  assert.isUndefined(result3.requestId)
  
  // Test with null URL (should not throw)
  const result4 = processURL(null)
  assert.isUndefined(result4.baseURL)
  assert.isUndefined(result4.requestId)
})

test("🐛 Consistent response type handling", () => {
  // Test consistent handling of different response types
  
  // Create a standard Response object
  const standardResponse = new Response("<html></html>", {
    status: 200,
    headers: { "Content-Type": "text/html" }
  })
  
  // Create a custom VisitResponse-like object
  const visitResponse = {
    statusCode: 200,
    redirected: false,
    responseHTML: "<html></html>"
  }
  
  // Function to normalize response objects
  function normalizeResponse(response) {
    if (!response) return null
    
    // If it's a standard Response object, convert it
    if (response instanceof Response) {
      return {
        statusCode: response.status,
        redirected: response.redirected,
        responseHTML: undefined // Would normally extract this from the response
      }
    }
    
    // If it already has statusCode, assume it's a VisitResponse
    if ("statusCode" in response) {
      return response
    }
    
    // Unknown response type
    return null
  }
  
  // Test with standard Response
  const normalized1 = normalizeResponse(standardResponse)
  assert.equal(normalized1.statusCode, 200)
  assert.isFalse(normalized1.redirected)
  assert.isUndefined(normalized1.responseHTML)
  
  // Test with VisitResponse
  const normalized2 = normalizeResponse(visitResponse)
  assert.equal(normalized2.statusCode, 200)
  assert.isFalse(normalized2.redirected)
  assert.equal(normalized2.responseHTML, "<html></html>")
  
  // Test with null
  const normalized3 = normalizeResponse(null)
  assert.isNull(normalized3)
})

test("🐛 URL creation with proper error handling", () => {
  // Test URL creation with proper error handling
  
  // Function to safely create a URL
  function safeCreateURL(urlString, base) {
    try {
      return new URL(urlString, base)
    } catch (error) {
      console.error(`Invalid URL: ${urlString}`)
      return null
    }
  }
  
  // Test with valid absolute URL
  const url1 = safeCreateURL("https://example.com")
  assert.instanceOf(url1, URL)
  assert.equal(url1.href, "https://example.com/")
  
  // Test with valid relative URL and base
  const url2 = safeCreateURL("/path", "https://example.com")
  assert.instanceOf(url2, URL)
  assert.equal(url2.href, "https://example.com/path")
  
  // Test with invalid URL (should not throw)
  const url3 = safeCreateURL("invalid-url")
  assert.isNull(url3)
  
  // Test with empty string (should not throw)
  const url4 = safeCreateURL("")
  assert.isNull(url4)
})

test("🔧 URL comparison with proper type handling", () => {
  // Test URL comparison with proper type handling
  
  // Function to safely compare URLs
  function urlsAreEqual(url1, url2) {
    // Handle null/undefined cases
    if (!url1 && !url2) return true
    if (!url1 || !url2) return false
    
    // Convert to URL objects if they're strings
    const urlObj1 = typeof url1 === "string" ? new URL(url1, document.baseURI) : url1
    const urlObj2 = typeof url2 === "string" ? new URL(url2, document.baseURI) : url2
    
    // Compare the string representations
    return urlObj1.toString() === urlObj2.toString()
  }
  
  // Test with identical URL objects
  const urlObj1 = new URL("https://example.com/path")
  const urlObj2 = new URL("https://example.com/path")
  assert.isTrue(urlsAreEqual(urlObj1, urlObj2))
  
  // Test with URL object and string
  assert.isTrue(urlsAreEqual(urlObj1, "https://example.com/path"))
  
  // Test with different URLs
  const urlObj3 = new URL("https://example.com/different")
  assert.isFalse(urlsAreEqual(urlObj1, urlObj3))
  
  // Test with null/undefined
  assert.isTrue(urlsAreEqual(null, null))
  assert.isTrue(urlsAreEqual(undefined, undefined))
  assert.isTrue(urlsAreEqual(null, undefined))
  assert.isFalse(urlsAreEqual(urlObj1, null))
  assert.isFalse(urlsAreEqual(null, urlObj1))
})
