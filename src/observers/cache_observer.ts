export class CacheObserver {
  readonly selector = "[data-turbo-temporary]"
  readonly deprecatedSelector = "[data-turbo-cache=false]"

  started = false

  start(): void {
    if (!this.started) {
      this.started = true
      addEventListener("turbo:before-cache", this.removeTemporaryElements, false)
    }
  }

  stop(): void {
    if (this.started) {
      this.started = false
      removeEventListener("turbo:before-cache", this.removeTemporaryElements, false)
    }
  }

  removeTemporaryElements = (_event: Event): void => {
    for (const element of this.temporaryElements) {
      element.remove()
    }
  }

  get temporaryElements(): Element[] {
    return [...document.querySelectorAll(this.selector), ...this.temporaryElementsWithDeprecation]
  }

  private get temporaryElementsWithDeprecation(): Element[] {
    const elements = document.querySelectorAll(this.deprecatedSelector)

    if (elements.length) {
      console.warn(
        `The ${this.deprecatedSelector} selector is deprecated and will be removed in a future version. Use ${this.selector} instead.`
      )
    }

    return [...elements]
  }
}
