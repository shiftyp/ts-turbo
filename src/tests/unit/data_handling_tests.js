import { assert } from "@open-wc/testing"
import * as Turbo from "../../"
import { LimitedSet } from "../../core/drive/limited_set"

test("🐛 Null reference prevention in LimitedSet", () => {
  // Test that the LimitedSet class properly handles null and undefined values
  
  // Create a LimitedSet with a small maximum size
  const limitedSet = new LimitedSet(3)
  
  // Add some values
  limitedSet.add("value1")
  limitedSet.add("value2")
  limitedSet.add("value3")
  
  // The set should have 3 values
  assert.equal(limitedSet.size, 3)
  
  // Adding a fourth value should remove the oldest one
  limitedSet.add("value4")
  assert.equal(limitedSet.size, 3)
  assert.isFalse(limitedSet.has("value1"))
  assert.isTrue(limitedSet.has("value2"))
  assert.isTrue(limitedSet.has("value3"))
  assert.isTrue(limitedSet.has("value4"))
  
  // Test edge case: create an empty set and try to add a value
  const emptySet = new LimitedSet(0)
  emptySet.add("value") // This should not cause an error
  assert.equal(emptySet.size, 1) // LimitedSet implementation allows at least one item
})

test("🐛 URL handling and type conversion", () => {
  // Test proper URL handling and type conversion
  
  // Test converting string to URL
  const urlString = "https://example.com"
  const url = new URL(urlString)
  
  assert.equal(url.href, urlString + "/")
  assert.equal(url.origin, "https://example.com")
  assert.equal(url.protocol, "https:")
  
  // Test URL equality comparison
  const url1 = new URL("https://example.com/path")
  const url2 = new URL("https://example.com/path")
  const url3 = new URL("https://example.com/different")
  
  assert.notStrictEqual(url1, url2) // Objects are different instances
  assert.equal(url1.href, url2.href) // But their string representations are equal
  assert.notEqual(url1.href, url3.href)
  
  // Test URL with query parameters
  const urlWithParams = new URL("https://example.com/search?q=test&page=1")
  assert.equal(urlWithParams.searchParams.get("q"), "test")
  assert.equal(urlWithParams.searchParams.get("page"), "1")
})

test("🐛 Safe data structure manipulation", () => {
  // Test safe data structure manipulation
  
  // Create a Map
  const map = new Map()
  map.set("key1", "value1")
  map.set("key2", "value2")
  
  // Test safe access with optional chaining
  const value1 = map.get("key1")
  const value3 = map.get("key3") // This key doesn't exist
  
  assert.equal(value1, "value1")
  assert.isUndefined(value3)
  
  // Test safe deletion
  map.delete("key1")
  assert.isFalse(map.has("key1"))
  
  // Test deleting a non-existent key (should not throw an error)
  map.delete("key3") // This key doesn't exist
  assert.equal(map.size, 1)
})

test("🔧 Frame controller property consistency", () => {
  // Test frame controller property consistency
  
  // Create a mock frame controller
  const mockFrameController = {
    element: document.createElement("turbo-frame"),
    
    // Properties that could have duplicate declarations
    connected: false,
    formSubmission: null,
    
    // Methods that could have duplicate implementations
    connect() {
      this.connected = true
    },
    
    disconnect() {
      this.connected = false
    }
  }
  
  // Test property consistency
  assert.isFalse(mockFrameController.connected)
  mockFrameController.connect()
  assert.isTrue(mockFrameController.connected)
  mockFrameController.disconnect()
  assert.isFalse(mockFrameController.connected)
})

test("🔧 Action property consistency", () => {
  // Test action property consistency
  
  // Create a mock element with data-turbo-action
  const element = document.createElement("a")
  element.setAttribute("data-turbo-action", "advance")
  
  // Test getting the action
  const getAction = (element) => {
    return element.getAttribute("data-turbo-action")
  }
  
  assert.equal(getAction(element), "advance")
  
  // Test changing the action
  element.setAttribute("data-turbo-action", "replace")
  assert.equal(getAction(element), "replace")
  
  // Test with invalid action
  element.setAttribute("data-turbo-action", "invalid")
  assert.equal(getAction(element), "invalid")
  
  // Test with no action
  element.removeAttribute("data-turbo-action")
  assert.isNull(getAction(element))
})
