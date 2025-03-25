import { Idiomorph } from "idiomorph"
import { FrameElement } from "../elements/frame_element"
import { dispatch } from "../util"
import { urlsAreEqual } from "./url"

interface MorphCallbacks {
  beforeNodeMorphed?: (currentElement: Element | Node, newElement: Element | Node) => boolean
}

interface MorphOptions {
  callbacks?: MorphCallbacks
  morphStyle?: "innerHTML" | "outerHTML"
  [key: string]: any
}

interface IdiomorphCallbacks {
  beforeNodeAdded: (node: Node) => boolean
  beforeNodeMorphed: (currentElement: Node, newElement: Node) => boolean
  beforeAttributeUpdated: (attributeName: string, target: Element, mutationType: string) => boolean
  beforeNodeRemoved: (node: Node) => boolean
  afterNodeMorphed: (currentElement: Node, newElement: Node) => void
}

export function morphElements(
  currentElement: Element | Node | NodeListOf<ChildNode>,
  newElement: Element | Node | NodeListOf<ChildNode>,
  { callbacks, ...options }: MorphOptions = {}
): void {
  Idiomorph.morph(currentElement, newElement, {
    ...options,
    callbacks: new DefaultIdiomorphCallbacks(callbacks)
  })
}

export function morphChildren(
  currentElement: Element | Node,
  newElement: Element | Node,
  options: MorphOptions = {}
): void {
  morphElements(currentElement, newElement.childNodes, {
    ...options,
    morphStyle: "innerHTML"
  })
}

export function shouldRefreshFrameWithMorphing(
  currentFrame: Element,
  newFrame: Element
): boolean {
  return currentFrame instanceof FrameElement &&
    // newFrame cannot yet be an instance of FrameElement because custom
    // elements don't get initialized until they're attached to the DOM, so
    // test its Element#nodeName instead
    newFrame instanceof Element && newFrame.nodeName === "TURBO-FRAME" &&
    (currentFrame as FrameElement).shouldReloadWithMorph &&
    currentFrame.id === newFrame.id &&
    (!newFrame.getAttribute("src") || urlsAreEqual((currentFrame as FrameElement).src || "", newFrame.getAttribute("src") || "")) &&
    !currentFrame.closest("[data-turbo-permanent]")
}

export function closestFrameReloadableWithMorphing(node: Node): Element | null {
  // Safe handling of non-Element nodes
  if (node instanceof Element) {
    return node.closest("turbo-frame[src][refresh=morph]")
  } else if (node.parentElement) {
    return node.parentElement.closest("turbo-frame[src][refresh=morph]")
  }
  return null
}

class DefaultIdiomorphCallbacks implements IdiomorphCallbacks {
  #beforeNodeMorphed: (currentElement: Element | Node, newElement: Element | Node) => boolean

  constructor({ beforeNodeMorphed }: MorphCallbacks = {}) {
    this.#beforeNodeMorphed = beforeNodeMorphed || (() => true)
  }

  beforeNodeAdded = (node: Node): boolean => {
    // Only Element nodes have id and hasAttribute
    if (node instanceof Element) {
      return !(node.id && node.hasAttribute("data-turbo-permanent") && document.getElementById(node.id))
    }
    return true
  }

  beforeNodeMorphed = (currentElement: Node, newElement: Node): boolean => {
    if (currentElement instanceof Element) {
      if (!currentElement.hasAttribute("data-turbo-permanent") && this.#beforeNodeMorphed(currentElement, newElement)) {
        const event = dispatch("turbo:before-morph-element", {
          cancelable: true,
          target: currentElement,
          detail: { currentElement, newElement }
        })

        return !event.defaultPrevented
      } else {
        return false
      }
    }
    return true
  }

  beforeAttributeUpdated = (attributeName: string, target: Element, mutationType: string): boolean => {
    const event = dispatch("turbo:before-morph-attribute", {
      cancelable: true,
      target,
      detail: { attributeName, mutationType }
    })

    return !event.defaultPrevented
  }

  beforeNodeRemoved = (node: Node): boolean => {
    return this.beforeNodeMorphed(node, node)
  }

  afterNodeMorphed = (currentElement: Node, newElement: Node): void => {
    if (currentElement instanceof Element) {
      dispatch("turbo:morph-element", {
        target: currentElement,
        detail: { currentElement, newElement }
      })
    }
  }
}
