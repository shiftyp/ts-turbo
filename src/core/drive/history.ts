import { nextMicrotask, uuid } from "../../util"
import { HistoryDelegate, RestorationData, TurboHistoryState } from "../types"

export class History {
  location?: URL
  restorationIdentifier: string = uuid()
  restorationData: Record<string, RestorationData> = {}
  started: boolean = false
  pageLoaded: boolean = false
  currentIndex: number = 0
  previousScrollRestoration?: ScrollRestoration

  constructor(private readonly delegate: HistoryDelegate) {}

  start(): void {
    if (!this.started) {
      addEventListener("popstate", this.onPopState, false)
      addEventListener("load", this.onPageLoad, false)
      const state = history.state as TurboHistoryState | null
      this.currentIndex = state?.turbo?.restorationIndex || 0
      this.started = true
      this.replace(new URL(window.location.href))
    }
  }

  stop(): void {
    if (this.started) {
      removeEventListener("popstate", this.onPopState, false)
      removeEventListener("load", this.onPageLoad, false)
      this.started = false
    }
  }

  push(location: URL, restorationIdentifier?: string): void {
    this.update(history.pushState.bind(history), location, restorationIdentifier)
  }

  replace(location: URL, restorationIdentifier?: string): void {
    this.update(history.replaceState.bind(history), location, restorationIdentifier)
  }

  update(
    method: typeof history.pushState | typeof history.replaceState,
    location: URL,
    restorationIdentifier: string = uuid()
  ): void {
    if (method === history.pushState) ++this.currentIndex

    const state: TurboHistoryState = { 
      turbo: { 
        restorationIdentifier, 
        restorationIndex: this.currentIndex 
      } 
    }
    method(state, "", location.href)
    this.location = location
    this.restorationIdentifier = restorationIdentifier
  }

  // Restoration data

  getRestorationDataForIdentifier(restorationIdentifier: string): RestorationData {
    return this.restorationData[restorationIdentifier] || {}
  }

  updateRestorationData(additionalData: RestorationData): void {
    const { restorationIdentifier } = this
    const restorationData = this.restorationData[restorationIdentifier]
    this.restorationData[restorationIdentifier] = {
      ...restorationData,
      ...additionalData
    }
  }

  // Scroll restoration

  assumeControlOfScrollRestoration(): void {
    if (!this.previousScrollRestoration) {
      this.previousScrollRestoration = history.scrollRestoration ?? "auto"
      history.scrollRestoration = "manual"
    }
  }

  relinquishControlOfScrollRestoration(): void {
    if (this.previousScrollRestoration) {
      history.scrollRestoration = this.previousScrollRestoration
      delete this.previousScrollRestoration
    }
  }

  // Event handlers

  private onPopState = (event: PopStateEvent): void => {
    if (this.shouldHandlePopState()) {
      const { turbo } = (event.state || {}) as TurboHistoryState
      if (turbo) {
        this.location = new URL(window.location.href)
        const { restorationIdentifier, restorationIndex } = turbo
        this.restorationIdentifier = restorationIdentifier
        const direction = restorationIndex > this.currentIndex ? "forward" : "back"
        this.delegate.historyPoppedToLocationWithRestorationIdentifierAndDirection(
          this.location,
          restorationIdentifier,
          direction
        )
        this.currentIndex = restorationIndex
      }
    }
  }

  private onPageLoad = async (_event: Event): Promise<void> => {
    await nextMicrotask()
    this.pageLoaded = true
  }

  private shouldHandlePopState(): boolean {
    // Safari dispatches a popstate event after window's load event, ignore it
    return this.pageIsLoaded()
  }

  private pageIsLoaded(): boolean {
    return this.pageLoaded || document.readyState === "complete"
  }
}
