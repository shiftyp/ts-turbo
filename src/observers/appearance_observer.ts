export interface AppearanceDelegate {
  elementAppearedInViewport(element: Element): void
}

export class AppearanceObserver {
  started = false
  readonly delegate: AppearanceDelegate
  readonly element: Element
  readonly intersectionObserver: IntersectionObserver

  constructor(delegate: AppearanceDelegate, element: Element) {
    this.delegate = delegate
    this.element = element
    this.intersectionObserver = new IntersectionObserver(this.intersect)
  }

  start(): void {
    if (!this.started) {
      this.started = true
      this.intersectionObserver.observe(this.element)
    }
  }

  stop(): void {
    if (this.started) {
      this.started = false
      this.intersectionObserver.unobserve(this.element)
    }
  }

  intersect = (entries: IntersectionObserverEntry[]): void => {
    const lastEntry = entries.slice(-1)[0]
    if (lastEntry?.isIntersecting) {
      this.delegate.elementAppearedInViewport(this.element)
    }
  }
}
