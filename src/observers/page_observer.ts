export const enum PageStage {
  initial = 0,
  loading = 1,
  interactive = 2,
  complete = 3
}

export interface PageDelegate {
  pageBecameInteractive(): void
  pageLoaded(): void
  pageWillUnload(): void
}

export class PageObserver {
  stage: PageStage = PageStage.initial
  started = false
  readonly delegate: PageDelegate

  constructor(delegate: PageDelegate) {
    this.delegate = delegate
  }

  start(): void {
    if (!this.started) {
      if (this.stage == PageStage.initial) {
        this.stage = PageStage.loading
      }
      document.addEventListener("readystatechange", this.interpretReadyState, false)
      addEventListener("pagehide", this.pageWillUnload, false)
      this.started = true
    }
  }

  stop(): void {
    if (this.started) {
      document.removeEventListener("readystatechange", this.interpretReadyState, false)
      removeEventListener("pagehide", this.pageWillUnload, false)
      this.started = false
    }
  }

  private interpretReadyState = (): void => {
    const { readyState } = this
    if (readyState == "interactive") {
      this.pageIsInteractive()
    } else if (readyState == "complete") {
      this.pageIsComplete()
    }
  }

  private pageIsInteractive(): void {
    if (this.stage == PageStage.loading) {
      this.stage = PageStage.interactive
      this.delegate.pageBecameInteractive()
    }
  }

  private pageIsComplete(): void {
    this.pageIsInteractive()
    if (this.stage == PageStage.interactive) {
      this.stage = PageStage.complete
      this.delegate.pageLoaded()
    }
  }

  private pageWillUnload = (): void => {
    this.delegate.pageWillUnload()
  }

  private get readyState(): DocumentReadyState {
    return document.readyState
  }
}
