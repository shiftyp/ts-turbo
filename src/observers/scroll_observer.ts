export interface ScrollPosition {
  x: number
  y: number
}

export interface ScrollDelegate {
  scrollPositionChanged(position: ScrollPosition): void
}

export class ScrollObserver {
  started = false
  readonly delegate: ScrollDelegate

  constructor(delegate: ScrollDelegate) {
    this.delegate = delegate
  }

  start(): void {
    if (!this.started) {
      addEventListener("scroll", this.onScroll, false)
      this.onScroll()
      this.started = true
    }
  }

  stop(): void {
    if (this.started) {
      removeEventListener("scroll", this.onScroll, false)
      this.started = false
    }
  }

  private onScroll = (): void => {
    this.updatePosition({ x: window.pageXOffset, y: window.pageYOffset })
  }

  private updatePosition(position: ScrollPosition): void {
    this.delegate.scrollPositionChanged(position)
  }
}
