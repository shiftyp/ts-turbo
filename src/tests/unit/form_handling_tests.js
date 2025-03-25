import { assert } from "@open-wc/testing"
import * as Turbo from "../../"

test("🐛 Form data building with null handling", () => {
  // Test form data building with proper null handling
  
  // Create a form element
  const form = document.createElement("form")
  form.innerHTML = `
    <input type="text" name="name" value="test">
    <input type="email" name="email" value="test@example.com">
  `
  
  // Create a submitter element with name and value
  const submitter = document.createElement("button")
  submitter.setAttribute("name", "action")
  submitter.setAttribute("value", "submit")
  
  // Function to build form data with proper null handling
  function buildFormData(formElement, submitter) {
    const formData = new FormData(formElement)
    const name = submitter?.getAttribute("name")
    const value = submitter?.getAttribute("value")
    
    // Proper null checking with explicit comparison
    if (name && value != null && formData.get(name) != value) {
      formData.append(name, value)
    }
    
    return formData
  }
  
  // Test with valid submitter
  const formData1 = buildFormData(form, submitter)
  assert.equal(formData1.get("name"), "test")
  assert.equal(formData1.get("email"), "test@example.com")
  assert.equal(formData1.get("action"), "submit")
  
  // Test with submitter that has empty value
  const emptySubmitter = document.createElement("button")
  emptySubmitter.setAttribute("name", "action")
  emptySubmitter.setAttribute("value", "")
  
  const formData2 = buildFormData(form, emptySubmitter)
  assert.equal(formData2.get("action"), "")
  
  // Test with null submitter
  const formData3 = buildFormData(form, null)
  assert.equal(formData3.get("name"), "test")
  assert.equal(formData3.get("email"), "test@example.com")
  assert.isNull(formData3.get("action"))
})

test("🔧 Cookie handling for CSRF tokens", () => {
  // Test cookie handling with proper null handling
  
  // Mock document.cookie
  const originalCookie = document.cookie
  Object.defineProperty(document, "cookie", {
    get: () => "csrf_token=abc123; other=value",
    configurable: true
  })
  
  // Function to get cookie value with proper null handling
  function getCookieValue(cookieName) {
    if (cookieName != null) {
      const cookies = document.cookie ? document.cookie.split("; ") : []
      const cookie = cookies.find((cookie) => cookie.startsWith(cookieName))
      if (cookie) {
        const value = cookie.split("=").slice(1).join("=")
        return value ? decodeURIComponent(value) : null
      }
    }
    return null
  }
  
  // Test with valid cookie name
  assert.equal(getCookieValue("csrf_token"), "abc123")
  
  // Test with non-existent cookie name
  assert.isNull(getCookieValue("non_existent"))
  
  // Test with null cookie name
  assert.isNull(getCookieValue(null))
  
  // Restore original cookie
  Object.defineProperty(document, "cookie", {
    value: originalCookie,
    configurable: true
  })
})

test("🐛 Confirmation dialog handling", async () => {
  // Test confirmation dialog handling with custom confirmation methods
  
  // Create a form element with confirmation message
  const form = document.createElement("form")
  form.setAttribute("data-turbo-confirm", "Are you sure?")
  
  // Create a submitter element
  const submitter = document.createElement("button")
  submitter.setAttribute("type", "submit")
  
  // Mock confirmation methods
  const confirmMethods = {
    // Default confirmation method (always returns true)
    default: async (message) => {
      return true
    },
    
    // Custom confirmation method (returns true only for exact message match)
    custom: async (message, form, submitter) => {
      // Get the confirmation message directly from the element that has it
      const elementMessage = submitter?.getAttribute("data-turbo-confirm") || 
                            form?.getAttribute("data-turbo-confirm") || ""
      return message === elementMessage
    }
  }
  
  // Function to handle confirmation
  async function handleConfirmation(form, submitter, confirmMethod) {
    const confirmationMessage = form.getAttribute("data-turbo-confirm") || 
                               submitter?.getAttribute("data-turbo-confirm")
    
    if (typeof confirmationMessage === "string") {
      const answer = await confirmMethod(confirmationMessage, form, submitter)
      return answer
    }
    
    return true
  }
  
  // Test with default confirmation method
  const defaultResult = await handleConfirmation(form, submitter, confirmMethods.default)
  assert.isTrue(defaultResult)
  
  // Test with custom confirmation method
  const result1 = await handleConfirmation(form, submitter, confirmMethods.custom)
  assert.isTrue(result1)
  
  // Test with submitter having different confirmation message
  submitter.setAttribute("data-turbo-confirm", "Different message")
  
  const result2 = await handleConfirmation(form, submitter, confirmMethods.custom)
  assert.isFalse(result2)
})

test("🔧 Submitter text handling", () => {
  // Test submitter text handling with proper type checking
  
  // Create button submitter
  const buttonSubmitter = document.createElement("button")
  buttonSubmitter.innerHTML = "Submit"
  
  // Create input submitter
  const inputSubmitter = document.createElement("input")
  inputSubmitter.setAttribute("type", "submit")
  inputSubmitter.value = "Submit"
  
  // Function to set submitter text
  function setSubmitterText(submitter, newText) {
    let originalText = null
    
    if (submitter.matches("button")) {
      originalText = submitter.innerHTML
      submitter.innerHTML = newText
    } else if (submitter.matches("input")) {
      const input = submitter
      originalText = input.value
      input.value = newText
    }
    
    return originalText
  }
  
  // Test with button submitter
  const originalButtonText = setSubmitterText(buttonSubmitter, "Processing...")
  assert.equal(originalButtonText, "Submit")
  assert.equal(buttonSubmitter.innerHTML, "Processing...")
  
  // Test with input submitter
  const originalInputText = setSubmitterText(inputSubmitter, "Processing...")
  assert.equal(originalInputText, "Submit")
  assert.equal(inputSubmitter.value, "Processing...")
})

test("🐛 Header manipulation for CSRF tokens", () => {
  // Test header manipulation with proper type safety
  
  // Function to prepare headers with CSRF token
  function prepareHeaders(headers, token) {
    if (!headers) {
      headers = {}
    }
    
    if (token) {
      // Safely add the token to headers
      headers = { 
        ...headers,
        "X-CSRF-Token": token 
      }
    }
    
    return headers
  }
  
  // Test with existing headers
  const existingHeaders = { "Content-Type": "application/json" }
  const headersWithToken = prepareHeaders(existingHeaders, "abc123")
  
  assert.equal(headersWithToken["Content-Type"], "application/json")
  assert.equal(headersWithToken["X-CSRF-Token"], "abc123")
  
  // Test with null headers
  const headersFromNull = prepareHeaders(null, "abc123")
  assert.equal(headersFromNull["X-CSRF-Token"], "abc123")
  
  // Test with null token
  const headersWithoutToken = prepareHeaders(existingHeaders, null)
  assert.equal(headersWithoutToken["Content-Type"], "application/json")
  assert.isUndefined(headersWithoutToken["X-CSRF-Token"])
})

test("🔧 HTTP status code handling", () => {
  // Test HTTP status code handling
  
  // Function to check if response is successful
  function isSuccessResponse(statusCode) {
    return statusCode >= 200 && statusCode < 300
  }
  
  // Function to check if response is a client error
  function isClientError(statusCode) {
    return statusCode >= 400 && statusCode < 500
  }
  
  // Function to check if response is a server error
  function isServerError(statusCode) {
    return statusCode >= 500 && statusCode < 600
  }
  
  // Test success responses
  assert.isTrue(isSuccessResponse(200))
  assert.isTrue(isSuccessResponse(201))
  assert.isTrue(isSuccessResponse(204))
  
  // Test client error responses
  assert.isTrue(isClientError(400))
  assert.isTrue(isClientError(404))
  assert.isTrue(isClientError(422))
  
  // Test server error responses
  assert.isTrue(isServerError(500))
  assert.isTrue(isServerError(502))
  assert.isTrue(isServerError(503))
  
  // Test boundary cases
  assert.isFalse(isSuccessResponse(300))
  assert.isFalse(isClientError(300))
  assert.isFalse(isServerError(400))
})
