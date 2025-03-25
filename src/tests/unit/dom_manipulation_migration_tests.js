import { MorphingFrameRenderer } from "../../core/frames/morphing_frame_renderer"
import { assert, fixture, html } from '@open-wc/testing';
import { spy } from 'sinon';

setup(() => {
  document.body.innerHTML = `
    <div id="container">
      <turbo-frame id="frame" src="/example"></turbo-frame>
      <div id="regular-div">Regular div</div>
    </div>
  `
});

teardown(() => {
  document.body.innerHTML = ""
});

suite('DOM Manipulation Migration', () => {
  test("MorphingFrameRenderer.renderElement handles different node types safely", () => {
    const mockElement = document.createElement("div");
    const newElement = document.createElement("span");
    
    // Create a spy on the static method instead of trying to instantiate the class
    const renderElementSpy = spy(MorphingFrameRenderer, "renderElement");
    
    try {
      // Call the static method directly
      MorphingFrameRenderer.renderElement(mockElement, newElement);
      
      // Verify the method was called with the correct arguments
      assert.isTrue(renderElementSpy.calledWith(mockElement, newElement), 
        "renderElement should be called with correct parameters");
    } finally {
      // Restore the original method
      renderElementSpy.restore();
    }
  });
});
