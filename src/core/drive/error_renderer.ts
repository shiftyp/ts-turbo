import { activateScriptElement } from "../../util"
import { Renderer } from "../renderer"

export class ErrorRenderer extends Renderer {
  static renderElement(currentElement: HTMLElement, newElement: HTMLElement): void {
    const { documentElement, body } = document
    documentElement.replaceChild(newElement, body)
  }

  async render(): Promise<void> {
    this.replaceHeadAndBody()
    this.activateScriptElements()
  }

  private replaceHeadAndBody(): void {
    const { documentElement, head } = document
    documentElement.replaceChild(this.newHead, head)
    this.renderElement(this.currentElement, this.newElement)
  }

  private activateScriptElements(): void {
    for (const replaceableElement of this.scriptElements) {
      const parentNode = replaceableElement.parentNode
      if (parentNode) {
        const element = activateScriptElement(replaceableElement)
        parentNode.replaceChild(element, replaceableElement)
      }
    }
  }

  private get newHead(): HTMLHeadElement {
    // Add type assertion to specify that newSnapshot is a PageSnapshot
    return (this.newSnapshot as any).headSnapshot.element as HTMLHeadElement
  }

  private get scriptElements(): NodeListOf<HTMLScriptElement> {
    return document.documentElement.querySelectorAll("script")
  }
}
