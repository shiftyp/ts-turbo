import { activateScriptElement, waitForLoad } from "../../util"
import { Renderer } from "../renderer"
import { PageSnapshot } from "./page_snapshot"

interface ReloadReason {
  reason: "turbo_visit_control_is_reload" | "tracked_element_mismatch"
}

export class PageRenderer extends Renderer {
  static renderElement(currentElement: HTMLElement, newElement: HTMLElement): void {
    if (document.body && newElement instanceof HTMLBodyElement) {
      document.body.replaceWith(newElement)
    } else {
      document.documentElement.appendChild(newElement)
    }
  }

  get shouldRender(): boolean {
    return (this.newSnapshot as PageSnapshot).isVisitable && this.trackedElementsAreIdentical
  }

  get reloadReason(): string | undefined {
    if (!(this.newSnapshot as PageSnapshot).isVisitable) {
      return "turbo_visit_control_is_reload"
    }

    if (!this.trackedElementsAreIdentical) {
      return "tracked_element_mismatch"
    }
    return undefined
  }

  async prepareToRender(): Promise<void> {
    this.#setLanguage()
    await this.mergeHead()
  }

  async render(): Promise<void> {
    if (this.willRender) {
      await this.replaceBody()
    }
  }

  finishRendering(): void {
    super.finishRendering()
    if (!this.isPreview) {
      this.focusFirstAutofocusableElement()
    }
  }

  get currentHeadSnapshot() {
    return (this.currentSnapshot as PageSnapshot).headSnapshot
  }

  get newHeadSnapshot() {
    return (this.newSnapshot as PageSnapshot).headSnapshot
  }

  get newElement(): HTMLElement {
    return (this.newSnapshot as PageSnapshot).element as HTMLElement
  }

  #setLanguage(): void {
    const { documentElement } = this.currentSnapshot as PageSnapshot
    const { lang } = this.newSnapshot as PageSnapshot

    if (lang) {
      documentElement.setAttribute("lang", lang)
    } else {
      documentElement.removeAttribute("lang")
    }
  }

  async mergeHead(): Promise<void> {
    const mergedHeadElements = this.mergeProvisionalElements()
    const newStylesheetElements = this.copyNewHeadStylesheetElements()
    this.copyNewHeadScriptElements()

    await mergedHeadElements
    await newStylesheetElements

    if (this.willRender) {
      this.removeUnusedDynamicStylesheetElements()
    }
  }

  async replaceBody(): Promise<void> {
    await this.preservingPermanentElements(async () => {
      this.activateNewBody()
      await this.assignNewBody()
    })
  }

  get trackedElementsAreIdentical(): boolean {
    return this.currentHeadSnapshot.trackedElementSignature == this.newHeadSnapshot.trackedElementSignature
  }

  async copyNewHeadStylesheetElements(): Promise<void> {
    const loadingElements: Promise<void>[] = []

    for (const element of this.newHeadStylesheetElements) {
      loadingElements.push(waitForLoad(element as HTMLElement))
      document.head.appendChild(element)
    }

    await Promise.all(loadingElements)
  }

  copyNewHeadScriptElements(): void {
    for (const element of this.newHeadScriptElements) {
      document.head.appendChild(activateScriptElement(element as HTMLScriptElement))
    }
  }

  removeUnusedDynamicStylesheetElements(): void {
    for (const element of this.unusedDynamicStylesheetElements) {
      document.head.removeChild(element)
    }
  }

  async mergeProvisionalElements(): Promise<void> {
    const newHeadElements = [...this.newHeadProvisionalElements]

    for (const element of this.currentHeadProvisionalElements) {
      if (!this.isCurrentElementInElementList(element, newHeadElements)) {
        document.head.removeChild(element)
      }
    }

    for (const element of newHeadElements) {
      document.head.appendChild(element)
    }
  }

  private isCurrentElementInElementList(element: Element, elementList: Element[]): boolean {
    for (const [index, newElement] of elementList.entries()) {
      // if title element...
      if (element.tagName == "TITLE") {
        if (newElement.tagName != "TITLE") {
          continue
        }
        if (element.innerHTML == newElement.innerHTML) {
          elementList.splice(index, 1)
          return true
        }
      }

      // if any other element...
      if (newElement.isEqualNode(element)) {
        elementList.splice(index, 1)
        return true
      }
    }

    return false
  }

  private removeCurrentHeadProvisionalElements(): void {
    for (const element of this.currentHeadProvisionalElements) {
      document.head.removeChild(element)
    }
  }

  private copyNewHeadProvisionalElements(): void {
    for (const element of this.newHeadProvisionalElements) {
      document.head.appendChild(element)
    }
  }

  private activateNewBody(): void {
    document.adoptNode(this.newElement)
    this.activateNewBodyScriptElements()
  }

  private activateNewBodyScriptElements(): void {
    for (const inertScriptElement of this.newBodyScriptElements) {
      const activatedScriptElement = activateScriptElement(inertScriptElement)
      inertScriptElement.replaceWith(activatedScriptElement)
    }
  }

  private async assignNewBody(): Promise<void> {
    await this.renderElement(this.currentElement, this.newElement)
  }

  private get unusedDynamicStylesheetElements(): Element[] {
    return this.oldHeadStylesheetElements.filter((element) => {
      return element.getAttribute("data-turbo-track") === "dynamic"
    })
  }

  private get oldHeadStylesheetElements(): Element[] {
    return this.currentHeadSnapshot.getStylesheetElementsNotInSnapshot(this.newHeadSnapshot)
  }

  private get newHeadStylesheetElements(): Element[] {
    return this.newHeadSnapshot.getStylesheetElementsNotInSnapshot(this.currentHeadSnapshot)
  }

  private get newHeadScriptElements(): Element[] {
    return this.newHeadSnapshot.getScriptElementsNotInSnapshot(this.currentHeadSnapshot)
  }

  private get currentHeadProvisionalElements(): Element[] {
    return this.currentHeadSnapshot.provisionalElements
  }

  private get newHeadProvisionalElements(): Element[] {
    return this.newHeadSnapshot.provisionalElements
  }

  private get newBodyScriptElements(): NodeListOf<HTMLScriptElement> {
    return this.newElement.querySelectorAll("script")
  }
}
