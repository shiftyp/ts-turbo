import { assert } from "@open-wc/testing"

// Test DOM manipulation issues identified during TypeScript migration
test("🐛 Element type safety in node processing", () => {
  // Test proper type checking before accessing Element-specific properties
  
  // Create different node types
  const element = document.createElement("div")
  const textNode = document.createTextNode("text content")
  const commentNode = document.createComment("comment")
  
  // Test element-specific properties and methods
  assert.isTrue(element instanceof Element)
  assert.isTrue(element instanceof Node)
  assert.isFalse(textNode instanceof Element)
  assert.isTrue(textNode instanceof Node)
  
  // Element-specific properties should exist on elements but not on other node types
  assert.exists(element.id)
  assert.exists(element.hasAttribute)
  assert.isFunction(element.getAttribute)
  assert.isFunction(element.setAttribute)
  
  // These properties should not exist on text nodes
  assert.notExists(textNode.id)
  assert.notExists(textNode.hasAttribute)
  assert.notExists(textNode.getAttribute)
  assert.notExists(textNode.setAttribute)
  
  // Safe property access pattern
  function safeGetId(node) {
    return node instanceof Element ? node.id : null
  }
  
  // Test safe property access
  assert.isNull(safeGetId(textNode))
  assert.equal(safeGetId(element), "")
  
  // Set ID and test again
  element.id = "test-id"
  assert.equal(safeGetId(element), "test-id")
})

test("🐛 Null reference safety in parent element traversal", () => {
  // Test safe parent element traversal with proper null checks
  
  // Create a simple DOM structure
  const parent = document.createElement("div")
  const child = document.createElement("span")
  const grandchild = document.createElement("a")
  
  parent.appendChild(child)
  child.appendChild(grandchild)
  
  // Test parent traversal
  assert.equal(grandchild.parentElement, child)
  assert.equal(child.parentElement, parent)
  assert.isNull(parent.parentElement) // Parent is not attached to document
  
  // Safe parent traversal function
  function findAncestorWithId(node) {
    let current = node
    while (current && current.parentElement) {
      current = current.parentElement
      if (current instanceof Element && current.id) {
        return current
      }
    }
    return null
  }
  
  // Test with no matching ancestor
  assert.isNull(findAncestorWithId(grandchild))
  
  // Add ID to parent and test again
  parent.id = "parent-id"
  
  // Create a new structure with the existing elements to test
  const newParent = document.createElement("div")
  newParent.appendChild(parent)
  
  // Now grandchild should find the parent with ID
  assert.equal(findAncestorWithId(grandchild), parent)
})

test("🔧 Node type-specific processing", () => {
  // Test specialized handling for different node types
  
  // Create different node types
  const element = document.createElement("div")
  const textNode = document.createTextNode("text content")
  const commentNode = document.createComment("comment")
  
  // Create a document fragment with mixed node types
  const fragment = document.createDocumentFragment()
  fragment.appendChild(element.cloneNode())
  fragment.appendChild(textNode.cloneNode())
  fragment.appendChild(commentNode.cloneNode())
  
  // Process nodes with type-specific handling
  let elementCount = 0
  let textCount = 0
  let otherCount = 0
  
  // Process each node in the fragment
  Array.from(fragment.childNodes).forEach(node => {
    if (node instanceof Element) {
      elementCount++
    } else if (node instanceof Text) {
      textCount++
    } else {
      otherCount++
    }
  })
  
  // Verify counts
  assert.equal(elementCount, 1)
  assert.equal(textCount, 1)
  assert.equal(otherCount, 1) // Comment node
})

test("🔧 URL comparison with null safety", () => {
  // Test URL comparison with proper null handling
  
  // Create elements with and without src attributes
  const withSrc = document.createElement("iframe")
  const withEmptySrc = document.createElement("iframe")
  const withoutSrc = document.createElement("iframe")
  
  // Set src attributes
  withSrc.src = "https://example.com/page"
  withEmptySrc.src = ""
  
  // Safe URL comparison function
  function urlsAreEqual(element1, element2) {
    const url1 = element1.getAttribute("src")
    const url2 = element2.getAttribute("src")
    
    // If both are null/undefined or empty, consider them equal
    if ((!url1 || url1 === "") && (!url2 || url2 === "")) {
      return true
    }
    
    // If only one is null/undefined/empty, they're not equal
    if (!url1 || !url2 || url1 === "" || url2 === "") {
      return false
    }
    
    // Compare normalized URLs
    try {
      const normalizedUrl1 = new URL(url1, document.baseURI).href
      const normalizedUrl2 = new URL(url2, document.baseURI).href
      return normalizedUrl1 === normalizedUrl2
    } catch (error) {
      // Handle invalid URLs
      return url1 === url2
    }
  }
  
  // Test URL comparisons
  assert.isTrue(urlsAreEqual(withoutSrc, withoutSrc))
  assert.isTrue(urlsAreEqual(withEmptySrc, withoutSrc))
  assert.isTrue(urlsAreEqual(withSrc, withSrc))
  assert.isFalse(urlsAreEqual(withSrc, withoutSrc))
  assert.isFalse(urlsAreEqual(withSrc, withEmptySrc))
})

test("🔧 Element closest method with null safety", () => {
  // Test safe usage of closest method with proper type checks
  
  // Create a DOM structure
  const container = document.createElement("div")
  container.innerHTML = `
    <div class="parent">
      <span class="child">
        <a class="grandchild">Link</a>
      </span>
    </div>
  `
  
  // Get elements
  const parent = container.querySelector(".parent")
  const child = container.querySelector(".child")
  const grandchild = container.querySelector(".grandchild")
  const textNode = grandchild.firstChild // This is a text node
  
  // Safe closest function that works with any node type
  function safeClosest(node, selector) {
    // If node is not an Element, get its parent element first
    const element = node instanceof Element ? node : node.parentElement
    
    // If we couldn't get an element, return null
    if (!element) return null
    
    // Now safely call closest
    return element.closest(selector)
  }
  
  // Test with Element nodes
  assert.equal(safeClosest(grandchild, ".parent"), parent)
  assert.equal(safeClosest(child, ".parent"), parent)
  assert.equal(safeClosest(parent, ".parent"), parent)
  
  // Test with Text node
  assert.equal(safeClosest(textNode, ".parent"), parent)
  
  // Test with non-matching selector
  assert.isNull(safeClosest(grandchild, ".nonexistent"))
  assert.isNull(safeClosest(textNode, ".nonexistent"))
})
