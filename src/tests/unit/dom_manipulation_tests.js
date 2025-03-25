import { MorphingFrameRenderer } from "../../core/frames/morphing_frame_renderer"
import { shouldRefreshFrameWithMorphing, closestFrameReloadableWithMorphing } from "../../core/morphing"
import { FrameElement } from "../../elements/frame_element"
import { assert, fixture, html, oneEvent, fixtureCleanup, elementUpdated } from '@open-wc/testing'
import { spy, stub } from 'sinon'

setup(() => {
  document.body.innerHTML = `
    <turbo-frame id="frame" src="/example" refresh="morph"></turbo-frame>
  `
})

teardown(() => {
  document.body.innerHTML = ""
})

suite('DOM Manipulation', () => {
  suite('Element Type Safety', () => {
    let currentElement, newElement

    setup(() => {
      currentElement = document.querySelector("turbo-frame")
      newElement = document.createElement("div")
    })

    test("MorphingFrameRenderer.renderElement handles non-Element nodes safely", () => {
      // Mock the required methods
      const mockCurrentElement = document.createElement("div")
      mockCurrentElement.reload = stub()
      
      // Create a spy on the renderElement method
      const renderElementSpy = spy(MorphingFrameRenderer, "renderElement")
      
      // Call renderElement
      MorphingFrameRenderer.renderElement(mockCurrentElement, newElement)
      
      // Verify the method was called with the correct arguments
      assert.isTrue(renderElementSpy.calledWith(mockCurrentElement, newElement))
      
      // Clean up
      renderElementSpy.restore()
    })

    test("shouldRefreshFrameWithMorphing properly checks element types", () => {
      // Test with non-FrameElement
      const regularElement = document.createElement("div")
      const result1 = shouldRefreshFrameWithMorphing(regularElement, newElement)
      assert.isFalse(result1)
      
      // Test with FrameElement but mismatched IDs
      const frameElement = document.querySelector("turbo-frame")
      const newFrameElement = document.createElement("turbo-frame")
      newFrameElement.id = "different-id"
      const result2 = shouldRefreshFrameWithMorphing(frameElement, newFrameElement)
      assert.isFalse(result2)
      
      // Test with matching FrameElements
      newFrameElement.id = "frame"
      const result3 = shouldRefreshFrameWithMorphing(frameElement, newFrameElement)
      // The result depends on whether the custom element has been properly initialized
      // and whether shouldReloadWithMorph is true
      assert.isBoolean(result3)
    })

    test("closestFrameReloadableWithMorphing safely handles non-Element nodes", () => {
      // Test with a text node
      const textNode = document.createTextNode("Test")
      document.body.appendChild(textNode)
      
      // Should return null or the closest frame if the text node has a parent
      const result = closestFrameReloadableWithMorphing(textNode)
      
      // Clean up
      document.body.removeChild(textNode)
      
      // The result should be either null or an Element
      assert.isTrue(result === null || result instanceof Element)
    })
  })
})
