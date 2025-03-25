import { getAnchor } from "./url"
import { Snapshot } from "./snapshot"
import { Renderer } from "./renderer"
import { ReloadReason } from "./types"

export interface ViewDelegate {
  allowsImmediateRender(snapshot: Snapshot, options: RenderOptions): boolean
  viewRenderedSnapshot(snapshot: Snapshot, isPreview: boolean, renderMethod: string): void
  preloadOnLoadLinksForView(element: Element): void
  viewInvalidated(reason: ReloadReason): void
}

interface RenderOptions {
  resume: (value: unknown) => void
  render: () => Promise<void>
  renderMethod: string
}

interface ScrollPosition {
  x: number
  y: number
}

export class View {
  readonly delegate: ViewDelegate
  readonly element: Element
  renderer?: Renderer
  renderPromise?: Promise<void>
  snapshot?: Snapshot
  lastRenderedLocation?: URL
  #resolveRenderPromise = (_value: void) => {}
  #resolveInterceptionPromise = (_value: unknown) => {}

  constructor(delegate: ViewDelegate, element: Element) {
    this.delegate = delegate
    this.element = element
  }

  // Scrolling
  scrollToAnchor(anchor: string | undefined): void {
    if (!this.snapshot) return

    const element = anchor ? this.snapshot.getElementForAnchor(anchor) : null
    if (element) {
      this.scrollToElement(element)
      this.focusElement(element)
    } else {
      this.scrollToPosition({ x: 0, y: 0 })
    }
  }

  scrollToAnchorFromLocation(location: URL): void {
    this.scrollToAnchor(getAnchor(location))
  }

  scrollToElement(element: Element): void {
    element.scrollIntoView()
  }

  focusElement(element: Element): void {
    if (element instanceof HTMLElement) {
      if (element.hasAttribute("tabindex")) {
        element.focus()
      } else {
        element.setAttribute("tabindex", "-1")
        element.focus()
        element.removeAttribute("tabindex")
      }
    }
  }

  scrollToPosition({ x, y }: ScrollPosition): void {
    this.scrollRoot.scrollTo(x, y)
  }

  scrollToTop(): void {
    this.scrollToPosition({ x: 0, y: 0 })
  }

  get scrollRoot(): Window {
    return window
  }

  // Rendering
  async render(renderer: Renderer): Promise<void> {
    const { isPreview, shouldRender, willRender, newSnapshot: snapshot } = renderer

    // A workaround to ignore tracked element mismatch reloads when performing
    // a promoted Visit from a frame navigation
    const shouldInvalidate = willRender

    if (shouldRender) {
      try {
        this.renderPromise = new Promise((resolve) => (this.#resolveRenderPromise = resolve))
        this.renderer = renderer
        await this.prepareToRenderSnapshot(renderer)

        const renderInterception = new Promise((resolve) => (this.#resolveInterceptionPromise = resolve))
        const options: RenderOptions = { 
          resume: this.#resolveInterceptionPromise, 
          render: async () => {
            // Create a wrapper that safely accesses the renderer's functionality
            // without directly accessing protected members
            if (this.renderer) {
              await this.renderSnapshot(this.renderer);
            }
            return Promise.resolve();
          },
          renderMethod: this.renderer.renderMethod 
        }
        const immediateRender = this.delegate.allowsImmediateRender(snapshot, options)
        if (!immediateRender) await renderInterception

        await this.renderSnapshot(renderer)
        this.delegate.viewRenderedSnapshot(snapshot, isPreview, this.renderer.renderMethod)
        this.delegate.preloadOnLoadLinksForView(this.element)
        this.finishRenderingSnapshot(renderer)
      } finally {
        delete this.renderer
        this.#resolveRenderPromise(undefined)
        delete this.renderPromise
      }
    } else if (shouldInvalidate) {
      this.invalidate(renderer.reloadReason)
    }
  }

  invalidate(reason: string | undefined): void {
    const reloadReason: ReloadReason = reason ? { reason } : { reason: "turbo:page-expired" }
    this.delegate.viewInvalidated(reloadReason)
  }

  async prepareToRenderSnapshot(renderer: Renderer): Promise<void> {
    this.markAsPreview(renderer.isPreview)
    await renderer.prepareToRender()
  }

  markAsPreview(isPreview: boolean): void {
    if (isPreview) {
      this.element.setAttribute("data-turbo-preview", "")
    } else {
      this.element.removeAttribute("data-turbo-preview")
    }
  }

  markVisitDirection(direction: string): void {
    this.element.setAttribute("data-turbo-visit-direction", direction)
  }

  unmarkVisitDirection(): void {
    this.element.removeAttribute("data-turbo-visit-direction")
  }

  async renderSnapshot(renderer: Renderer): Promise<void> {
    await renderer.render()
  }

  finishRenderingSnapshot(renderer: Renderer): void {
    renderer.finishRendering()
  }
}
