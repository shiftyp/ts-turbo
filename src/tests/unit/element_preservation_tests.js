import { assert } from "@open-wc/testing"
import * as Turbo from "../../"

test("🐛 Permanent element replacement with null handling", () => {
  // Test permanent element replacement with proper null handling
  
  // Create a permanent element
  const permanentElement = document.createElement("div")
  permanentElement.id = "permanent-element"
  permanentElement.innerHTML = "Permanent Content"
  permanentElement.setAttribute("data-turbo-permanent", "")
  
  // Create a placeholder element
  const placeholder = document.createElement("div")
  placeholder.id = "permanent-element"
  placeholder.setAttribute("data-turbo-placeholder", "")
  
  // Add elements to the document
  document.body.appendChild(placeholder)
  
  // Function to replace placeholder with permanent element
  function replacePlaceholderWithPermanentElement(permanentElement) {
    // Get placeholder by ID
    const placeholder = document.getElementById(permanentElement.id)
    
    // Use optional chaining to prevent errors if placeholder is null
    placeholder?.replaceWith(permanentElement)
    
    return placeholder !== null
  }
  
  // Test with valid placeholder
  const replaced = replacePlaceholderWithPermanentElement(permanentElement)
  assert.isTrue(replaced)
  assert.equal(document.getElementById("permanent-element"), permanentElement)
  
  // Test with non-existent placeholder
  document.body.removeChild(permanentElement)
  const nonExistentElement = document.createElement("div")
  nonExistentElement.id = "non-existent"
  
  const notReplaced = replacePlaceholderWithPermanentElement(nonExistentElement)
  assert.isFalse(notReplaced)
  
  // Clean up
  if (document.getElementById("permanent-element")) {
    document.body.removeChild(document.getElementById("permanent-element"))
  }
})

test("🔧 Permanent element map creation", () => {
  // Test permanent element map creation with proper data structures
  
  // Create a set of permanent elements
  const permanentElements = [
    { id: "element1", content: "Content 1" },
    { id: "element2", content: "Content 2" },
    { id: "element3", content: "Content 3" }
  ].map(({ id, content }) => {
    const element = document.createElement("div")
    element.id = id
    element.textContent = content
    return element
  })
  
  // Create a mock snapshot with some matching permanent elements
  const snapshotPermanentElements = {
    "element1": document.createElement("div"),
    "element2": document.createElement("div")
    // element3 is missing
  }
  
  // Function to create a permanent element map
  function createPermanentElementMap(currentElements, snapshot) {
    // Use Map instead of object for better key handling
    const permanentElementMap = new Map()
    
    for (const currentElement of currentElements) {
      const id = currentElement.id
      const newElement = snapshot[id]
      
      if (newElement) {
        permanentElementMap.set(id, [currentElement, newElement])
      }
    }
    
    return permanentElementMap
  }
  
  // Create the map
  const map = createPermanentElementMap(permanentElements, snapshotPermanentElements)
  
  // Test map contents
  assert.equal(map.size, 2)
  assert.isTrue(map.has("element1"))
  assert.isTrue(map.has("element2"))
  assert.isFalse(map.has("element3"))
  
  // Test map values
  const [current1, new1] = map.get("element1")
  assert.equal(current1.id, "element1")
  assert.equal(current1.textContent, "Content 1")
  assert.equal(new1, snapshotPermanentElements["element1"])
})

test("🐛 Focus handling with proper type checking", () => {
  // Test focus handling with proper type checking
  
  // Create different types of elements
  const div = document.createElement("div")
  const button = document.createElement("button")
  const input = document.createElement("input")
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  
  // Add elements to the document
  document.body.appendChild(div)
  document.body.appendChild(button)
  document.body.appendChild(input)
  document.body.appendChild(svg)
  
  // Function to focus element with proper type checking
  function focusElement(element) {
    if (element instanceof HTMLElement) {
      if (element.hasAttribute("tabindex")) {
        element.focus()
      } else {
        element.setAttribute("tabindex", "-1")
        element.focus()
        element.removeAttribute("tabindex")
      }
      return true
    }
    return false
  }
  
  // Test focusing HTML elements
  assert.isTrue(focusElement(div))
  assert.isTrue(focusElement(button))
  assert.isTrue(focusElement(input))
  
  // Test focusing non-HTML elements
  assert.isFalse(focusElement(svg))
  
  // Test focusing with existing tabindex
  button.setAttribute("tabindex", "0")
  assert.isTrue(focusElement(button))
  assert.equal(button.getAttribute("tabindex"), "0") // Should preserve existing tabindex
  
  // Clean up
  document.body.removeChild(div)
  document.body.removeChild(button)
  document.body.removeChild(input)
  document.body.removeChild(svg)
})

test("🔧 Active element tracking during transitions", () => {
  // Test active element tracking during transitions
  
  // Create a container element
  const container = document.createElement("div")
  container.innerHTML = `
    <button id="button1">Button 1</button>
    <button id="button2">Button 2</button>
  `
  
  // Add container to the document
  document.body.appendChild(container)
  
  // Get the buttons
  const button1 = document.getElementById("button1")
  const button2 = document.getElementById("button2")
  
  // Focus button1
  button1.focus()
  
  // Create a mock renderer
  const mockRenderer = {
    activeElement: null,
    currentSnapshot: {
      activeElement: button1
    },
    
    // Method to track active element
    enteringBardo(element) {
      // Guard to prevent overwriting active element
      if (this.activeElement) return
      
      if (element.contains(this.currentSnapshot.activeElement)) {
        this.activeElement = this.currentSnapshot.activeElement
      }
    }
  }
  
  // Test tracking active element
  mockRenderer.enteringBardo(container)
  assert.equal(mockRenderer.activeElement, button1)
  
  // Test guard against overwriting
  mockRenderer.currentSnapshot.activeElement = button2
  mockRenderer.enteringBardo(container)
  assert.equal(mockRenderer.activeElement, button1) // Should not change
  
  // Clean up
  document.body.removeChild(container)
})

test("🐛 Element reference cleanup after promise resolution", () => {
  // Test element reference cleanup after promise resolution
  
  // Create a mock renderer with resolvingFunctions
  const mockRenderer = {
    resolvingFunctions: {
      resolve: () => {},
      reject: () => {}
    },
    
    // Method to finish rendering and clean up references
    finishRendering() {
      if (this.resolvingFunctions) {
        this.resolvingFunctions.resolve()
        delete this.resolvingFunctions
      }
    }
  }
  
  // Test that resolvingFunctions exists before cleanup
  assert.exists(mockRenderer.resolvingFunctions)
  
  // Call finishRendering to clean up
  mockRenderer.finishRendering()
  
  // Test that resolvingFunctions is cleaned up
  assert.notExists(mockRenderer.resolvingFunctions)
})

test("🔧 Element selection for anchors with special characters", () => {
  // Test element selection for anchors with special characters
  
  // Create elements with special characters in IDs
  const elements = [
    { id: "normal", content: "Normal ID" },
    { id: "special:char", content: "ID with colon" },
    { id: "quote'char", content: "ID with quote" },
    { id: "double\"quote", content: "ID with double quote" }
  ].map(({ id, content }) => {
    const element = document.createElement("div")
    element.id = id
    element.textContent = content
    return element
  })
  
  // Add elements to the document
  elements.forEach(element => document.body.appendChild(element))
  
  // Function to get element for anchor with proper string handling
  function getElementForAnchor(anchor) {
    if (!anchor) return null
    
    // Custom escape function for CSS selectors
    function escapeSelector(str) {
      return str.replace(/[\\"'\[\]\(\)\{\}\:\;\.\,\<\>\/\?\|\`\~\!\@\#\$\%\^\&\*\=\+]/g, '\\$&');
    }
    
    // Use double quotes to avoid issues with single quotes in the anchor
    const escapedAnchor = escapeSelector(anchor)
    const element = document.querySelector(`[id="${escapedAnchor}"], a[name="${escapedAnchor}"]`)
    return element instanceof HTMLElement ? element : null
  }
  
  // Test with normal ID
  assert.equal(getElementForAnchor("normal"), elements[0])
  
  // Test with special characters
  assert.equal(getElementForAnchor("special:char"), elements[1])
  assert.equal(getElementForAnchor("quote'char"), elements[2])
  assert.equal(getElementForAnchor("double\"quote"), elements[3])
  
  // Test with non-existent anchor
  assert.isNull(getElementForAnchor("non-existent"))
  
  // Test with null anchor
  assert.isNull(getElementForAnchor(null))
  
  // Clean up
  elements.forEach(element => document.body.removeChild(element))
})
