import { Bardo } from "./bardo"
import { Snapshot } from "./snapshot"

export abstract class Renderer {
  readonly currentSnapshot: Snapshot
  readonly newSnapshot: Snapshot
  readonly isPreview: boolean
  readonly willRender: boolean
  protected readonly renderElement: (currentElement: HTMLElement, newElement: HTMLElement) => void
  protected resolvingFunctions?: { resolve: () => void; reject: () => void }
  readonly promise: Promise<void>
  #activeElement: HTMLElement | null = null

  static renderElement(currentElement: HTMLElement, newElement: HTMLElement): void {
    // Abstract method
  }

  constructor(
    currentSnapshot: Snapshot,
    newSnapshot: Snapshot,
    isPreview: boolean,
    willRender = true
  ) {
    this.currentSnapshot = currentSnapshot
    this.newSnapshot = newSnapshot
    this.isPreview = isPreview
    this.willRender = willRender
    this.renderElement = (this.constructor as typeof Renderer).renderElement
    this.promise = new Promise((resolve, reject) => (this.resolvingFunctions = { resolve, reject }))
  }

  get shouldRender(): boolean {
    return true
  }

  get shouldAutofocus(): boolean {
    return true
  }

  get reloadReason(): string | undefined {
    return undefined
  }

  prepareToRender(): void {
    return
  }

  abstract render(): Promise<void>

  finishRendering(): void {
    if (this.resolvingFunctions) {
      this.resolvingFunctions.resolve()
      delete this.resolvingFunctions
    }
  }

  async preservingPermanentElements(callback: () => void): Promise<void> {
    await Bardo.preservingPermanentElements(this, this.permanentElementMap, callback)
  }

  focusFirstAutofocusableElement(): void {
    if (this.shouldAutofocus) {
      const element = this.connectedSnapshot.firstAutofocusableElement
      if (element) {
        element.focus()
      }
    }
  }

  // Bardo delegate
  enteringBardo(currentPermanentElement: Element): void {
    if (this.#activeElement) return

    if (currentPermanentElement.contains(this.currentSnapshot.activeElement)) {
      this.#activeElement = this.currentSnapshot.activeElement as HTMLElement
    }
  }

  leavingBardo(currentPermanentElement: Element): void {
    if (currentPermanentElement.contains(this.#activeElement) && this.#activeElement instanceof HTMLElement) {
      this.#activeElement.focus()
      this.#activeElement = null
    }
  }

  get connectedSnapshot(): Snapshot {
    return this.newSnapshot.isConnected ? this.newSnapshot : this.currentSnapshot
  }

  get currentElement(): HTMLElement {
    return this.currentSnapshot.element as HTMLElement
  }

  get newElement(): HTMLElement {
    return this.newSnapshot.element as HTMLElement
  }

  get permanentElementMap(): Map<string, Element[]> {
    return this.currentSnapshot.getPermanentElementMapForSnapshot(this.newSnapshot)
  }

  get renderMethod(): string {
    return "replace"
  }
}
