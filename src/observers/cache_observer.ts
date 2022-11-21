import { TurboBeforeCacheEvent } from "../events"

export class CacheObserver {
  readonly selector: string = "[data-turbo-temporary]"
  readonly deprecatedSelector: string = "[data-turbo-cache=false]"

  started = false

  start() {
    if (!this.started) {
      this.started = true
      addEventListener("turbo:before-cache", this.removeTemporaryElements, false)
    }
  }

  stop() {
    if (this.started) {
      this.started = false
      removeEventListener("turbo:before-cache", this.removeTemporaryElements, false)
    }
  }

<<<<<<< HEAD
  removeTemporaryElements = <EventListener>((_event: TurboBeforeCacheEvent) => {
    for (const element of this.temporaryElements) {
      element.remove()
    }
  })

  get temporaryElements() {
    return [...document.querySelectorAll(this.selector), ...this.temporaryElementsWithDeprecation]
  }

  get temporaryElementsWithDeprecation() {
    const elements = document.querySelectorAll(this.deprecatedSelector)

    if (elements.length) {
      console.warn(
        `The ${this.deprecatedSelector} selector is deprecated and will be removed in a future version. Use ${this.selector} instead.`,
      )
    }

    return [...elements]
=======
  removeStaleElements = (_event: TurboBeforeCacheEvent) => {
    const staleElements = [...document.querySelectorAll('[data-turbo-cache="false"]')]

    for (const element of staleElements) {
      element.remove()
    }
>>>>>>> b47ac72... Reorganize Turbo Events and declare events on `WindowEventMap`
  }
}
