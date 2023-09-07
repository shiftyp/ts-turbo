import { PageSnapshot } from "./page_snapshot"
import { Renderer } from "../renderer"
import { activateScriptElement } from "../../util"

const SELECTORS = {
  SCRIPT_ELEMENTS: "script"
}

export class ErrorRenderer extends Renderer<HTMLBodyElement, PageSnapshot> {

  // Not in upstream
  private document: Document

  constructor(newElement: HTMLBodyElement, currentElement: HTMLBodyElement, document: Document, newSnapshot: PageSnapshot) {
    super()
    this.newElement = newElement
    this.currentElement = currentElement
    this.document = document
    this.newSnapshot = newSnapshot
  }

  async render() {
    this.replaceHeadAndBody()
    this.activateScriptElements()
  }

  replaceHeadAndBody() {
    const { documentElement, head } = this.document
    documentElement.replaceChild(this.newHead, head)
    this.replaceBody()
  }

  replaceBody() {
    this.renderElement(this.currentElement, this.newElement)
  }

  activateScriptElements() {
    const scriptElements = this.getScriptElements()
    scriptElements.forEach((replaceableElement: Element) => {
      const parentNode = replaceableElement.parentNode
      if (parentNode) {
        const element = activateScriptElement(replaceableElement as HTMLScriptElement)
        parentNode.replaceChild(element, replaceableElement)
      }
    })
  }

  get newHead() {
    return this.newSnapshot.headSnapshot.element
  }

  getScriptElements() {
    return this.document.documentElement.querySelectorAll(SELECTORS.SCRIPT_ELEMENTS)
  }
}
