import { Snapshot } from "../snapshot"
import { HeadSnapshot } from "./head_snapshot"

export class PageSnapshot extends Snapshot {
  static fromHTMLString(html?: string): PageSnapshot

  static fromElement(element: Element): PageSnapshot

  static fromDocument(document: {
    documentElement: HTMLElement,
    body: HTMLElement,
    head: HTMLHeadElement
  }): PageSnapshot

  readonly documentElement: HTMLElement
  readonly headSnapshot: HeadSnapshot

  constructor(documentElement: HTMLElement, body: HTMLElement, headSnapshot: HeadSnapshot)

  clone(): PageSnapshot

  get lang(): string | null

  get headElement(): HTMLHeadElement

  get rootLocation(): URL

  get cacheControlValue(): string | null

  get isPreviewable(): boolean

  get isCacheable(): boolean

  get isVisitable(): boolean

  get prefersViewTransitions(): boolean

  get shouldMorphPage(): boolean

  get shouldPreserveScrollPosition(): boolean

  protected getSetting(name: string): string | null
}
