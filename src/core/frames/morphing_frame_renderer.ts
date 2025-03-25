import { FrameRenderer } from "./frame_renderer.js"
import { morphChildren, shouldRefreshFrameWithMorphing, closestFrameReloadableWithMorphing } from "../morphing.js"
import { dispatch } from "../../util"

export class MorphingFrameRenderer extends FrameRenderer {
  static renderElement(currentElement: HTMLElement, newElement: HTMLElement): void {
    dispatch("turbo:before-frame-morph", {
      target: currentElement,
      detail: { currentElement, newElement }
    })

    morphChildren(currentElement, newElement, {
      callbacks: {
        beforeNodeMorphed: (node: Node, newNode: Node): boolean => {
          // Only proceed if both nodes are Elements as required by shouldRefreshFrameWithMorphing
          if (node instanceof Element && newNode instanceof Element) {
            if (
              shouldRefreshFrameWithMorphing(node, newNode) &&
                closestFrameReloadableWithMorphing(node) === currentElement
            ) {
              (node as any).reload()
              return false
            }
          }
          return true
        }
      }
    })
  }

  // Override base class method with same signature
  async preservingPermanentElements(callback: () => void): Promise<void> {
    // Simply execute the callback without any permanent element preservation
    // as morphing handles this differently
    await callback()
    return Promise.resolve()
  }
}
