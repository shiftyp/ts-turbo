const submittersByForm = new WeakMap<HTMLFormElement, HTMLElement>()

function findSubmitterFromClickTarget(target: EventTarget | null): HTMLElement | null {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null
  const candidate = element ? element.closest("input, button") : null
  return (candidate as HTMLInputElement)?.type == "submit" ? (candidate as HTMLElement) : null
}

function clickCaptured(event: MouseEvent): void {
  const submitter = findSubmitterFromClickTarget(event.target)

  const form = (submitter as HTMLInputElement)?.form
  if (submitter && form) {
    submittersByForm.set(form, submitter)
  }
}

(function () {
  if ("submitter" in Event.prototype) return

  let prototype: any = window.Event.prototype
  // Certain versions of Safari 15 have a bug where they won't
  // populate the submitter. This hurts TurboDrive's enable/disable detection.
  // See https://bugs.webkit.org/show_bug.cgi?id=229660
  if ("SubmitEvent" in window) {
    const prototypeOfSubmitEvent = (window as any).SubmitEvent.prototype

    if (/Apple Computer/.test(navigator.vendor) && !("submitter" in prototypeOfSubmitEvent)) {
      prototype = prototypeOfSubmitEvent
    } else {
      return // polyfill not needed
    }
  }

  Object.defineProperty(prototype, "submitter", {
    get() {
      if (this.type == "submit" && this.target instanceof HTMLFormElement) {
        return submittersByForm.get(this.target)
      }
    }
  })

  window.addEventListener("click", clickCaptured, true)
})()

// Ensure TypeScript parses this file as a module
export {}
