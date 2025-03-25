import { DispatchOptions } from "./core/types"

export function activateScriptElement(element: HTMLScriptElement): HTMLScriptElement

export function createDocumentFragment(html: string): DocumentFragment

export interface CustomEventDetail {
  url?: string
  newBody?: Element
  timing?: Record<string, number>
  originalEvent?: Event
  [key: string]: any
}

export function dispatch(
  eventName: string,
  options?: {
    target?: Element
    cancelable?: boolean
    detail?: CustomEventDetail
  }
): CustomEvent

export function cancelEvent(event: Event): void

export function nextRepaint(): Promise<void>

export function nextAnimationFrame(): Promise<void>

export function nextEventLoopTick(): Promise<void>

export function nextMicrotask(): Promise<void>

export function parseHTMLDocument(html?: string): Document

export function unindent(strings: TemplateStringsArray, ...values: any[]): string

export function uuid(): string

export function getAttribute(attributeName: string, ...elements: Element[]): string | null

export function hasAttribute(attributeName: string, ...elements: Element[]): boolean

export function markAsBusy(...elements: Element[]): void

export function clearBusyState(...elements: Element[]): void

export function waitForLoad(element: Element, timeoutInMilliseconds?: number): Promise<void>

export function getHistoryMethodForAction(action: string): typeof history.pushState | typeof history.replaceState

export function isAction(action: string): boolean

export function getVisitAction(...elements: Element[]): string | undefined

export function getMetaElement(name: string): HTMLMetaElement | null

export function getMetaContent(name: string): string

export function getCspNonce(): string | null

export function setMetaContent(name: string, content: string): void

export function findClosestRecursively(element: Element | null, selector: string): Element | null

export function elementIsFocusable(element: Element): boolean

export function queryAutofocusableElement(elementOrDocumentFragment: Element | DocumentFragment): Element | null

export function around<T, R>(
  callback: () => Promise<T>,
  reader: (value: T) => Promise<R>
): Promise<R>

export function doesNotTargetIFrame(target: EventTarget | null): boolean

export function findLinkFromClickTarget(target: EventTarget | null): HTMLAnchorElement | null

export function getLocationForLink(link: HTMLAnchorElement): URL

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void
