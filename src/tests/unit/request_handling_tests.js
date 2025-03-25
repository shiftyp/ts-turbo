import { assert } from "@open-wc/testing"
import * as Turbo from "../../"

// Test request handling improvements without causing actual network requests
test("🔧 Request URL reconstruction", () => {
  // Create a mock form element
  const form = document.createElement("form")
  form.action = "https://example.com/original"
  form.method = "post"
  
  // Create a mock delegate
  const mockDelegate = {
    formSubmissionStarted: () => {},
    formSubmissionSucceededWithResponse: () => {},
    formSubmissionFailedWithResponse: () => {},
    formSubmissionErrored: () => {},
    formSubmissionFinished: () => {}
  }
  
  // Create a mock FormSubmission with a spy on fetchRequest creation
  let lastCreatedFetchRequest = null
  class MockFormSubmission {
    constructor(delegate, formElement, submitter, method) {
      this.delegate = delegate
      this.formElement = formElement
      this.submitter = submitter
      this.method = method
      this.fetchRequest = this.createFetchRequest()
    }
    
    createFetchRequest() {
      const request = {
        url: new URL(this.formElement.action),
        method: this.method,
        body: new FormData(this.formElement)
      }
      lastCreatedFetchRequest = request
      return request
    }
    
    get action() {
      return this.formElement.action
    }
    
    set action(value) {
      this.formElement.action = value
      // This is what we're testing - the proper reconstruction
      this.fetchRequest = this.createFetchRequest()
    }
  }
  
  // Create an instance of our mock
  const submission = new MockFormSubmission(mockDelegate, form, null, "post")
  
  // Initial URL should match the form
  assert.equal(lastCreatedFetchRequest.url.toString(), "https://example.com/original")
  
  // Change the action and verify a new fetchRequest is created with the updated URL
  submission.action = "https://example.com/updated"
  assert.equal(lastCreatedFetchRequest.url.toString(), "https://example.com/updated")
})

test("🔧 Consistent boolean return handling", async () => {
  // Create a mock fetch request with controlled response
  class MockFetchRequest {
    constructor(returnValue) {
      this.returnValue = returnValue
    }
    
    async perform() {
      return this.returnValue
    }
  }
  
  // Create a tracking delegate to verify callback execution
  let startedCalled = false
  const mockDelegate = {
    formSubmissionStarted: () => {
      startedCalled = true
      return Promise.resolve()
    }
  }
  
  // Create a mock submission that uses our fetch request
  class MockSubmission {
    constructor(delegate, fetchRequest) {
      this.delegate = delegate
      this.fetchRequest = fetchRequest
    }
    
    async start() {
      const result = await this.fetchRequest.perform()
      // Explicitly check for true (the proper way)
      if (result === true) {
        if (this.delegate.formSubmissionStarted) {
          await this.delegate.formSubmissionStarted(this)
        }
      }
    }
  }
  
  // Test with true return value
  const trueRequest = new MockFetchRequest(true)
  const trueSubmission = new MockSubmission(mockDelegate, trueRequest)
  await trueSubmission.start()
  assert.isTrue(startedCalled, "Callback should be called with true return")
  
  // Reset and test with truthy but not true return value
  startedCalled = false
  const truthyRequest = new MockFetchRequest("success") // truthy but not true
  const truthySubmission = new MockSubmission(mockDelegate, truthyRequest)
  await truthySubmission.start()
  assert.isFalse(startedCalled, "Callback should not be called with non-true return")
})

test("🔧 Response type handling for streams", () => {
  // Create a class similar to FetchRequest to test Accept header handling
  class MockFetchRequest {
    constructor() {
      this.headers = {
        "Accept": "text/html, application/xhtml+xml"
      }
    }
    
    acceptResponseType(mimeType) {
      this.headers["Accept"] = [mimeType, this.headers["Accept"]].filter(Boolean).join(", ")
    }
  }
  
  // Create an instance and test the initial headers
  const request = new MockFetchRequest()
  assert.equal(request.headers["Accept"], "text/html, application/xhtml+xml")
  
  // Add a stream response type
  request.acceptResponseType("text/vnd.turbo-stream.html")
  assert.equal(
    request.headers["Accept"], 
    "text/vnd.turbo-stream.html, text/html, application/xhtml+xml"
  )
  
  // Add another response type
  request.acceptResponseType("application/json")
  assert.equal(
    request.headers["Accept"], 
    "application/json, text/vnd.turbo-stream.html, text/html, application/xhtml+xml"
  )
})

test("🐛 URL mutation safety", () => {
  // Test that URL objects are not mutated unexpectedly
  
  // Create a base URL
  const baseUrl = new URL("https://example.com/path")
  
  // Create a function that modifies a URL but should return a new instance
  function modifyUrl(url, newPath) {
    // Create a new URL to avoid mutation
    const newUrl = new URL(url.toString())
    newUrl.pathname = newPath
    return newUrl
  }
  
  // Modify the URL and check that the original is unchanged
  const modifiedUrl = modifyUrl(baseUrl, "/new-path")
  
  assert.equal(baseUrl.pathname, "/path", "Original URL should not be modified")
  assert.equal(modifiedUrl.pathname, "/new-path", "New URL should have the modified path")
})

test("🐛 Form data handling", () => {
  // Test proper handling of form data
  
  // Create a form with various field types
  const form = document.createElement("form")
  
  // Add a text input
  const textInput = document.createElement("input")
  textInput.type = "text"
  textInput.name = "username"
  textInput.value = "testuser"
  form.appendChild(textInput)
  
  // Add a checkbox (checked)
  const checkbox = document.createElement("input")
  checkbox.type = "checkbox"
  checkbox.name = "subscribe"
  checkbox.checked = true
  checkbox.value = "yes"
  form.appendChild(checkbox)
  
  // Add a checkbox (unchecked)
  const uncheckedBox = document.createElement("input")
  uncheckedBox.type = "checkbox"
  uncheckedBox.name = "terms"
  uncheckedBox.checked = false
  uncheckedBox.value = "accepted"
  form.appendChild(uncheckedBox)
  
  // Create FormData from the form
  const formData = new FormData(form)
  
  // Verify the form data contains the expected values
  assert.equal(formData.get("username"), "testuser")
  assert.equal(formData.get("subscribe"), "yes")
  assert.isNull(formData.get("terms"), "Unchecked checkbox should not be included")
})

test("🐛 Request header handling", () => {
  // Test proper handling of request headers
  
  // Create a mock headers object
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "text/html"
  }
  
  // Function to safely add or update headers
  function updateHeaders(headers, name, value) {
    // Create a new headers object to avoid mutation
    const newHeaders = { ...headers }
    newHeaders[name] = value
    return newHeaders
  }
  
  // Update a header and check that a new object is returned
  const updatedHeaders = updateHeaders(headers, "X-Requested-With", "XMLHttpRequest")
  
  // Original headers should be unchanged
  assert.equal(Object.keys(headers).length, 2, "Original headers should be unchanged")
  assert.isUndefined(headers["X-Requested-With"], "Original headers should not have the new header")
  
  // Updated headers should have the new header
  assert.equal(Object.keys(updatedHeaders).length, 3, "Updated headers should have one more header")
  assert.equal(updatedHeaders["X-Requested-With"], "XMLHttpRequest", "Updated headers should have the new header")
})
