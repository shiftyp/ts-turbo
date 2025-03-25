export const FrameLoadingStyle = {
  eager: "eager",
  lazy: "lazy"
} as const

export type FrameLoadingStyleType = typeof FrameLoadingStyle[keyof typeof FrameLoadingStyle]

export interface FrameElementDelegate {
  connect(): void
  disconnect(): void
  loadingStyleChanged(): void
  sourceURLChanged(): void
  disabledChanged(): void
  sourceURLReloaded(): Promise<void>
  formSubmitted(form: HTMLFormElement, submitter?: HTMLElement): void
  linkClickIntercepted(element: HTMLElement, url: URL, event: MouseEvent): void
  proposeVisitIfNavigatedWithAction(element: FrameElement, action: string): void
}

/**
 * Contains a fragment of HTML which is updated based on navigation within
 * it (e.g. via links or form submissions).
 *
 * @customElement turbo-frame
 * @example
 *   <turbo-frame id="messages">
 *     <a href="/messages/expanded">
 *       Show all expanded messages in this frame.
 *     </a>
 *
 *     <form action="/messages">
 *       Show response from this form within this frame.
 *     </form>
 *   </turbo-frame>
 */
export class FrameElement extends HTMLElement {
  static delegateConstructor: new (element: FrameElement) => FrameElementDelegate

  loaded: Promise<void> = Promise.resolve()
  delegate: FrameElementDelegate

  static get observedAttributes(): string[] {
    return ["disabled", "loading", "src"]
  }

  constructor() {
    super()
    this.delegate = new FrameElement.delegateConstructor(this)
  }

  connectedCallback(): void {
    this.delegate.connect()
  }

  disconnectedCallback(): void {
    this.delegate.disconnect()
  }

  reload(): Promise<void> {
    return this.delegate.sourceURLReloaded()
  }

  attributeChangedCallback(name: string): void {
    if (name == "loading") {
      this.delegate.loadingStyleChanged()
    } else if (name == "src") {
      this.delegate.sourceURLChanged()
    } else if (name == "disabled") {
      this.delegate.disabledChanged()
    }
  }

  /**
   * Gets the URL to lazily load source HTML from
   */
  get src(): string | null {
    return this.getAttribute("src")
  }

  /**
   * Sets the URL to lazily load source HTML from
   */
  set src(value: string | null) {
    if (value) {
      this.setAttribute("src", value)
    } else {
      this.removeAttribute("src")
    }
  }

  /**
   * Gets the refresh mode for the frame.
   */
  get refresh(): string | null {
    return this.getAttribute("refresh")
  }

  /**
   * Sets the refresh mode for the frame.
   */
  set refresh(value: string | null) {
    if (value) {
      this.setAttribute("refresh", value)
    } else {
      this.removeAttribute("refresh")
    }
  }

  get shouldReloadWithMorph(): boolean {
    return this.src !== null && this.refresh === "morph"
  }

  /**
   * Determines if the element is loading
   */
  get loading(): FrameLoadingStyleType {
    return frameLoadingStyleFromString(this.getAttribute("loading"))
  }

  /**
   * Sets the loading mode for the frame
   */
  set loading(value: FrameLoadingStyleType) {
    if (value) {
      this.setAttribute("loading", value)
    } else {
      this.removeAttribute("loading")
    }
  }

  /**
   * Gets the disabled state of the frame.
   *
   * If disabled, no requests will be intercepted by the frame.
   */
  get disabled(): boolean {
    return this.hasAttribute("disabled")
  }

  /**
   * Sets the disabled state of the frame.
   *
   * If disabled, no requests will be intercepted by the frame.
   */
  set disabled(value: boolean) {
    if (value) {
      this.setAttribute("disabled", "")
    } else {
      this.removeAttribute("disabled")
    }
  }

  /**
   * Gets the auto-scroll behavior for the frame.
   *
   * If true, the frame will be scrolled into view automatically on update.
   */
  get autoscroll(): boolean {
    return this.hasAttribute("autoscroll")
  }

  /**
   * Sets the auto-scroll behavior for the frame.
   *
   * If true, the frame will be scrolled into view automatically on update.
   */
  set autoscroll(value: boolean) {
    if (value) {
      this.setAttribute("autoscroll", "")
    } else {
      this.removeAttribute("autoscroll")
    }
  }

  /**
   * Determines if the element has finished loading
   */
  get complete(): boolean {
    return !this.src || this.hasAttribute("complete")
  }

  /**
   * Gets whether this is the topmost frame
   */
  get isActive(): boolean {
    return this.ownerDocument === document && !this.isPreview
  }

  /**
   * Gets whether this is a preview frame
   */
  get isPreview(): boolean {
    return this.ownerDocument?.documentElement !== document.documentElement
  }
}

function frameLoadingStyleFromString(style: string | null): FrameLoadingStyleType {
  switch (style) {
    case "eager":
      return FrameLoadingStyle.eager
    default:
      return FrameLoadingStyle.lazy
  }
}

export function getFrameElementById(id: string | null): FrameElement | null {
  if (id != null) {
    const element = document.getElementById(id)
    if (element instanceof FrameElement) {
      return element
    }
  }
  return null
}
