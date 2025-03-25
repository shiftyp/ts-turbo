import { FetchRequest } from "../../http/fetch_request"
import { FormSubmission } from "../../core/drive/form_submission"
import { config } from "../../core/config/index"
import { assert, fixture, html } from '@open-wc/testing'
import { stub, spy } from 'sinon'

// Setup test environment flag to prevent actual navigation
window.testEnvironment = true;

suite("FormSubmission Fixes Tests", function() {
  let fetchRequest, formSubmission, delegate, originalConfig, mockFormElement, mockSubmitter

  setup(function() {
    mockFormElement = document.createElement("form")
    mockSubmitter = document.createElement("button")
    mockFormElement.appendChild(mockSubmitter)

    // Set the test environment flag to prevent actual navigation
    window.testEnvironment = true

    // Store original config
    originalConfig = { ...config }

    // Create a mock fetch request
    fetchRequest = {
      url: new URL("http://example.com/form"),
      fetchOptions: { headers: {} },
      perform: stub().resolves({}),
      cancel: stub(),
      enctype: "application/x-www-form-urlencoded",
      isSafe: false,
      body: new FormData()
    }

    // Create a mock delegate
    delegate = {
      formSubmissionStarted: stub(),
      formSubmissionSucceededWithResponse: stub(),
      formSubmissionFailedWithResponse: stub(),
      formSubmissionErrored: stub(),
      formSubmissionFinished: stub()
    }

    // Set up the FormSubmission object with our mocks
    formSubmission = new FormSubmission(delegate, mockFormElement, mockSubmitter)
    formSubmission.fetchRequest = fetchRequest
  })

  teardown(function() {
    // Reset the test environment
    delete window.testEnvironment
    
    // Restore original config
    Object.assign(config, originalConfig)
  })

  suite("with undefined configuration properties", function() {
    setup(function() {
      // Clear forms config 
      config.forms = undefined
    })

    test("handles undefined config.forms property safely", async function() {
      // Should not throw an error when config.forms is undefined
      let error = null
      try {
        await formSubmission.start()
      } catch (e) {
        error = e
      }
      assert.isNull(error, "No error should be thrown when config.forms is undefined")
    })

    test("handles missing submitter configuration safely", async function() {
      // Set config but without submitter property
      config.forms = { otherProperty: true }
      
      // Should not throw an error when submitter handlers are called
      let error = null
      try {
        await formSubmission.start()
        formSubmission.requestStarted(fetchRequest)
        formSubmission.requestFinished(fetchRequest)
      } catch (e) {
        error = e
      }
      assert.isNull(error, "No error should be thrown with missing submitter configuration")
      
      // Ensure delegate methods were still called properly
      assert.isTrue(delegate.formSubmissionStarted.calledWith(formSubmission), "formSubmissionStarted should be called")
      assert.isTrue(delegate.formSubmissionFinished.calledWith(formSubmission), "formSubmissionFinished should be called")
    })
  })

  suite("with configuration event handlers", function() {
    setup(function() {
      // Set up config with mock event handlers
      config.forms = {
        submitter: {
          beforeSubmit: stub(),
          afterSubmit: stub()
        }
      }
    })

    test("calls submitter event handlers when they exist", async function() {
      await formSubmission.start()
      formSubmission.requestStarted(fetchRequest)
      formSubmission.requestFinished(fetchRequest)
      
      // Verify the config event handlers were called with the submitter
      assert.isTrue(config.forms.submitter.beforeSubmit.calledWith(mockSubmitter), "beforeSubmit should be called with submitter")
      assert.isTrue(config.forms.submitter.afterSubmit.calledWith(mockSubmitter), "afterSubmit should be called with submitter")
    })
  })

  suite("HTTP headers handling", function() {
    test("safely modifies headers for CSRF token", function() {
      // Add a meta tag with csrf token
      const metaTag = document.createElement("meta")
      metaTag.setAttribute("name", "csrf-token")
      metaTag.setAttribute("content", "test-token")
      document.head.appendChild(metaTag)
      
      try {
        // Verify headers are properly modified
        formSubmission.prepareRequest(fetchRequest)
        assert.equal(fetchRequest.fetchOptions.headers["X-CSRF-Token"], "test-token", "CSRF token should be set in headers")
      } finally {
        // Clean up
        document.head.removeChild(metaTag)
      }
    })
  })

  suite("Submitter text handling", function() {
    test("safely handles submitter text when submitsWith is undefined", function() {
      // formSubmission.submitsWith is undefined
      let error = null
      try {
        formSubmission.setSubmitsWith()
      } catch (e) {
        error = e
      }
      
      // Verify no errors were thrown and original text remains unchanged
      assert.isNull(error, "No error should be thrown with undefined submitsWith")
    })
    
    test("updates button submitter text when submitsWith is defined", function() {
      formSubmission.submitsWith = "Submitting..."
      formSubmission.setSubmitsWith()
      
      // Verify button innerHTML is updated
      assert.equal(mockSubmitter.innerHTML, "Submitting...", "Button innerHTML should be updated")
    })
    
    test("updates input submitter value when submitsWith is defined", function() {
      // Change submitter to input
      mockFormElement.removeChild(mockSubmitter)
      mockSubmitter = document.createElement("input")
      mockSubmitter.type = "submit"
      mockSubmitter.value = "Submit"
      mockFormElement.appendChild(mockSubmitter)
      
      // Update formSubmission with new submitter
      formSubmission = new FormSubmission(delegate, mockFormElement, mockSubmitter)
      formSubmission.fetchRequest = fetchRequest
      
      // Set submitsWith and update
      formSubmission.submitsWith = "Submitting..."
      formSubmission.setSubmitsWith()
      
      // Verify input value is updated
      assert.equal(mockSubmitter.value, "Submitting...", "Input value should be updated")
    })
  })
});

// Clean up test environment after all tests
window.testEnvironment = false;
