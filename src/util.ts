import { expandURL } from "./core/url"

export function activateScriptElement(element: HTMLScriptElement): HTMLScriptElement {
  if (element.getAttribute("data-turbo-eval") == "false") {
    return element
  } else {
    const createdScriptElement = document.createElement("script")
    const cspNonce = getCspNonce()
    if (cspNonce) {
      createdScriptElement.nonce = cspNonce
    }
    createdScriptElement.textContent = element.textContent
    createdScriptElement.async = false
    copyElementAttributes(createdScriptElement, element)
    return createdScriptElement
  }
}

function copyElementAttributes(destinationElement: Element, sourceElement: Element): void {
  for (const { name, value } of sourceElement.attributes) {
    destinationElement.setAttribute(name, value)
  }
}

export function createDocumentFragment(html: string): DocumentFragment {
  const template = document.createElement("template")
  template.innerHTML = html
  return template.content
}

interface DispatchOptions {
  target?: Element
  cancelable?: boolean
  detail?: any
}

export function dispatch(eventName: string, { target, cancelable, detail }: DispatchOptions = {}): CustomEvent {
  const event = new CustomEvent(eventName, {
    cancelable,
    bubbles: true,
    composed: true,
    detail
  })

  if (target && target.isConnected) {
    target.dispatchEvent(event)
  } else {
    document.documentElement.dispatchEvent(event)
  }

  return event
}

export function cancelEvent(event: Event): void {
  event.preventDefault()
  event.stopImmediatePropagation()
}

export function nextRepaint(): Promise<void> {
  if (document.visibilityState === "hidden") {
    return nextEventLoopTick()
  } else {
    return nextAnimationFrame()
  }
}

export function nextAnimationFrame(): Promise<void> {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

export function nextEventLoopTick(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), 0))
}

export function nextMicrotask(): Promise<void> {
  return Promise.resolve()
}

export function parseHTMLDocument(html: string = ""): Document {
  return new DOMParser().parseFromString(html, "text/html")
}

export function unindent(strings: TemplateStringsArray, ...values: any[]): string {
  const lines = interpolate(strings, values).replace(/^\n/, "").split("\n")
  const match = lines[0].match(/^\s+/)
  const indent = match ? match[0].length : 0
  return lines.map((line) => line.slice(indent)).join("\n")
}

function interpolate(strings: TemplateStringsArray, values: any[]): string {
  return strings.reduce((result, string, i) => {
    const value = values[i] == undefined ? "" : values[i]
    return result + string + value
  }, "")
}

export function uuid(): string {
  return Array.from({ length: 36 })
    .map((_, i) => {
      if (i == 8 || i == 13 || i == 18 || i == 23) {
        return "-"
      } else if (i == 14) {
        return "4"
      } else if (i == 19) {
        return (Math.floor(Math.random() * 4) + 8).toString(16)
      } else {
        return Math.floor(Math.random() * 15).toString(16)
      }
    })
    .join("")
}

export function getAttribute(attributeName: string, ...elements: (Element | null | undefined)[]): string | null {
  for (const value of elements.map((element) => element?.getAttribute(attributeName))) {
    if (typeof value == "string") return value
  }

  return null
}

export function hasAttribute(attributeName: string, ...elements: (Element | null | undefined)[]): boolean {
  return elements.some((element) => element && element.hasAttribute(attributeName))
}

export function markAsBusy(...elements: Element[]): void {
  for (const element of elements) {
    if (element.localName == "turbo-frame") {
      element.setAttribute("busy", "")
    }
    element.setAttribute("aria-busy", "true")
  }
}

export function clearBusyState(...elements: Element[]): void {
  for (const element of elements) {
    if (element.localName == "turbo-frame") {
      element.removeAttribute("busy")
    }

    element.removeAttribute("aria-busy")
  }
}

export function waitForLoad(element: HTMLElement, timeoutInMilliseconds: number = 2000): Promise<void> {
  return new Promise((resolve) => {
    const onComplete = () => {
      element.removeEventListener("error", onComplete)
      element.removeEventListener("load", onComplete)
      resolve()
    }

    element.addEventListener("load", onComplete, { once: true })
    element.addEventListener("error", onComplete, { once: true })
    setTimeout(resolve, timeoutInMilliseconds)
  })
}

type Action = "replace" | "advance" | "restore"
type HistoryMethod = typeof history.pushState | typeof history.replaceState

export function getHistoryMethodForAction(action: Action): HistoryMethod {
  switch (action) {
    case "replace":
      return history.replaceState
    case "advance":
    case "restore":
      return history.pushState
  }
}

export function isAction(action: string | null): action is Action {
  return action == "advance" || action == "replace" || action == "restore"
}

export function getVisitAction(...elements: (Element | null | undefined)[]): Action | null {
  const action = getAttribute("data-turbo-action", ...elements)

  return isAction(action) ? action : null
}

function getMetaElement(name: string): HTMLMetaElement | null {
  return document.querySelector(`meta[name="${name}"]`)
}

export function getMetaContent(name: string): string | null {
  const element = getMetaElement(name)
  return element && element.content
}

export function getCspNonce(): string | undefined {
  const element = getMetaElement("csp-nonce")

  if (element) {
    const { nonce, content } = element
    return nonce == "" ? content : nonce
  }
}

export function setMetaContent(name: string, content: string): HTMLMetaElement {
  let element = getMetaElement(name)

  if (!element) {
    element = document.createElement("meta") as HTMLMetaElement
    element.setAttribute("name", name)

    document.head.appendChild(element)
  }

  element.setAttribute("content", content)

  return element
}

export function findClosestRecursively(element: Node | null | undefined, selector: string): Element | null {
  if (element instanceof Element) {
    return (
      element.closest(selector) || findClosestRecursively(element.assignedSlot || (element.getRootNode() as ShadowRoot)?.host, selector)
    )
  }
  return null
}

export function elementIsFocusable(element: Element | null): boolean {
  const inertDisabledOrHidden = "[inert], :disabled, [hidden], details:not([open]), dialog:not([open])"

  return !!element && element.closest(inertDisabledOrHidden) == null && typeof (element as HTMLElement).focus == "function"
}

export function queryAutofocusableElement(elementOrDocumentFragment: Element | DocumentFragment): Element | null {
  return Array.from(elementOrDocumentFragment.querySelectorAll("[autofocus]")).find(elementIsFocusable) || null
}

export async function around<T>(callback: () => void, reader: () => T): Promise<[T, T]> {
  const before = reader()

  callback()

  await nextAnimationFrame()

  const after = reader()

  return [before, after]
}

export function doesNotTargetIFrame(name: string | null): boolean {
  if (name === "_blank") {
    return false
  } else if (name) {
    for (const element of document.getElementsByName(name)) {
      if (element instanceof HTMLIFrameElement) return false
    }

    return true
  } else {
    return true
  }
}

export function findLinkFromClickTarget(target: EventTarget | null): HTMLAnchorElement | null {
  return findClosestRecursively(target as Node, "a[href]:not([target^=_]):not([download])") as HTMLAnchorElement | null
}

export function getLocationForLink(link: Element): URL {
  return expandURL(link.getAttribute("href") || "")
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null

  return (...args: Parameters<T>) => {
    const callback = () => fn.apply(null, args)
    if (timeoutId !== null) clearTimeout(timeoutId)
    timeoutId = setTimeout(callback, delay) as unknown as number
  }
}
