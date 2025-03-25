import { activateScriptElement, nextRepaint } from "../../util"
import { Bardo } from "../bardo"
import { Renderer } from "../renderer"
import { Snapshot } from "../snapshot"

type ScrollLogicalPosition = "start" | "center" | "end" | "nearest"
type ScrollBehavior = "auto" | "smooth"

interface AutoscrollableElement extends HTMLElement {
  autoscroll?: boolean
}

export interface FrameRendererDelegate {
  willRenderFrame(currentElement: HTMLElement, newElement: HTMLElement): void
  willPermanentlyEnterView(newPermanentElement: Element): Promise<void>
  renderFrame(renderer: FrameRenderer): Promise<void>
}

export class FrameRenderer extends Renderer {
  // Use accessors instead of properties to match base class
  #currentFrameElement: HTMLElement
  #newFrameElement: HTMLElement

  constructor(
    delegate: FrameRendererDelegate,
    currentSnapshot: Snapshot,
    newSnapshot: Snapshot,
    isPreview: boolean,
    willRender = true
  ) {
    super(currentSnapshot, newSnapshot, isPreview, willRender)
    this.delegate = delegate
    this.#currentFrameElement = currentSnapshot.element as HTMLElement
    this.#newFrameElement = newSnapshot.element as HTMLElement
  }
  readonly delegate: FrameRendererDelegate

  // Override base class method with same signature
  enteringBardo(currentPermanentElement: Element): void {
    super.enteringBardo(currentPermanentElement);
    // Call async method separately to avoid changing the signature
    void this.delegate.willPermanentlyEnterView(currentPermanentElement);
  }

  leavingBardo(currentPermanentElement: Element): void {}

  // Override base class method with same signature
  async preservingPermanentElements(callback: () => void): Promise<void> {
    const permanentElementMap = new Map<string, Element[]>()
    for (const currentPermanentElement of this.currentElement.querySelectorAll("[id][data-turbo-permanent]")) {
      const { id } = currentPermanentElement
      const newPermanentElement = this.newElement.querySelector(`#${id}[data-turbo-permanent]`)
      if (newPermanentElement) {
        permanentElementMap.set(id, [currentPermanentElement, newPermanentElement])
      }
    }

    await Bardo.preservingPermanentElements(this, permanentElementMap, callback)
  }

  static renderElement(currentElement: HTMLElement, newElement: HTMLElement): void {
    const destinationRange = document.createRange()
    destinationRange.selectNodeContents(currentElement)
    destinationRange.deleteContents()

    const frameElement = newElement
    const sourceRange = frameElement.ownerDocument?.createRange()
    if (sourceRange) {
      sourceRange.selectNodeContents(frameElement)
      currentElement.appendChild(sourceRange.extractContents())
    }
  }



  get shouldRender(): boolean {
    return true
  }

  async render(): Promise<void> {
    await this.preservingPermanentElements(async () => {
      this.loadFrameElement()
      // Store the result of focusFirstAutofocusableElement in a boolean variable
      // The base class method doesn't return anything, so we need to handle this differently
      this.focusFirstAutofocusableElement()
      // Always scroll into view since we can't determine if focus succeeded
      this.scrollFrameIntoView()
      await this.delegate.renderFrame(this)
      this.activateScriptElements()
    })
  }

  loadFrameElement(): void {
    this.delegate.willRenderFrame(this.currentElement, this.newElement)
    FrameRenderer.renderElement(this.currentElement, this.newElement)
  }

  scrollFrameIntoView(): boolean {
    const currentElement = this.currentElement as AutoscrollableElement
    const newElement = this.newElement as AutoscrollableElement

    if (currentElement.autoscroll || newElement.autoscroll) {
      const element = currentElement.firstElementChild
      const block = readScrollLogicalPosition(currentElement.getAttribute("data-autoscroll-block"), "end")
      const behavior = readScrollBehavior(currentElement.getAttribute("data-autoscroll-behavior"), "auto")

      if (element) {
        element.scrollIntoView({ block, behavior })
        return true
      }
    }
    return false
  }

  activateScriptElements(): void {
    for (const inertScriptElement of this.newScriptElements) {
      const activatedScriptElement = activateScriptElement(inertScriptElement)
      inertScriptElement.replaceWith(activatedScriptElement)
    }
  }

  get newScriptElements(): NodeListOf<HTMLScriptElement> {
    return this.currentElement.querySelectorAll("script")
  }
}

function readScrollLogicalPosition(value: string | null, defaultValue: ScrollLogicalPosition): ScrollLogicalPosition {
  if (value == "end" || value == "start" || value == "center" || value == "nearest") {
    return value
  } else {
    return defaultValue
  }
}

function readScrollBehavior(value: string | null, defaultValue: ScrollBehavior): ScrollBehavior {
  if (value == "auto" || value == "smooth") {
    return value
  } else {
    return defaultValue
  }
}
