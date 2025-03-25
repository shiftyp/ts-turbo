interface Document {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished: Promise<void>
  }
}

export class ViewTransitioner {
  #viewTransitionStarted = false
  #lastOperation: Promise<void> = Promise.resolve()

  renderChange(useViewTransition: boolean, render: () => void | Promise<void>): Promise<void> {
    if (useViewTransition && this.viewTransitionsAvailable && !this.#viewTransitionStarted) {
      this.#viewTransitionStarted = true
      this.#lastOperation = this.#lastOperation.then(async () => {
        if (document.startViewTransition) {
          await document.startViewTransition(render).finished
        }
      })
    } else {
      this.#lastOperation = this.#lastOperation.then(render)
    }

    return this.#lastOperation
  }

  get viewTransitionsAvailable(): boolean {
    return !!document.startViewTransition
  }
}
