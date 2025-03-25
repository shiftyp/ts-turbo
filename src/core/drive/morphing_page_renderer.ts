import { PageRenderer } from "./page_renderer"
import { dispatch } from "../../util"
import { morphElements, shouldRefreshFrameWithMorphing, closestFrameReloadableWithMorphing } from "../morphing"

export class MorphingPageRenderer extends PageRenderer {
  static renderElement(currentElement: Element, newElement: Element): void {
    morphElements(currentElement, newElement, {
      callbacks: {
        beforeNodeMorphed: (node: Node, newNode: Node): boolean => {
          // Only proceed if both nodes are Elements as required by shouldRefreshFrameWithMorphing
          if (node instanceof Element && newNode instanceof Element) {
            if (
              shouldRefreshFrameWithMorphing(node, newNode) &&
                !closestFrameReloadableWithMorphing(node)
            ) {
              // Type assertion for reload() method which TypeScript doesn't know exists
              (node as any).reload()
              return false
            }
          }
          return true
        }
      }
    })

    dispatch("turbo:morph", { detail: { currentElement, newElement } })
  }

  async preservingPermanentElements(callback: () => void): Promise<void> {
    callback()
    return Promise.resolve()
  }

  get renderMethod(): string {
    return "morph"
  }

  get shouldAutofocus(): boolean {
    return false
  }
}
