import { parseHTMLDocument } from "../../util"
import { Snapshot } from "../snapshot"
import { expandURL } from "../url"
import { HeadSnapshot } from "./head_snapshot"

export class PageSnapshot extends Snapshot {
  readonly documentElement: HTMLElement
  readonly headSnapshot: HeadSnapshot

  static fromHTMLString(html = ""): PageSnapshot {
    return this.fromDocument(parseHTMLDocument(html))
  }

  static fromElement(element: Element): PageSnapshot {
    return this.fromDocument(element.ownerDocument!)
  }

  static fromDocument({ documentElement, body, head }: Document): PageSnapshot {
    return new this(documentElement as HTMLElement, body!, new HeadSnapshot(head!))
  }

  constructor(documentElement: HTMLElement, body: HTMLElement, headSnapshot: HeadSnapshot) {
    super(body)
    this.documentElement = documentElement
    this.headSnapshot = headSnapshot
  }

  clone(): PageSnapshot {
    const clonedElement = this.element.cloneNode(true) as HTMLElement

    const selectElements = this.element.querySelectorAll("select")
    const clonedSelectElements = clonedElement.querySelectorAll("select")

    for (const [index, source] of Array.from(selectElements).entries()) {
      const clone = clonedSelectElements[index]
      for (const option of Array.from(clone.selectedOptions)) option.selected = false
      for (const option of Array.from(source.selectedOptions)) clone.options[option.index].selected = true
    }

    for (const clonedPasswordInput of clonedElement.querySelectorAll('input[type="password"]')) {
      (clonedPasswordInput as HTMLInputElement).value = ""
    }

    return new PageSnapshot(this.documentElement, clonedElement, this.headSnapshot)
  }

  get lang(): string | null {
    return this.documentElement.getAttribute("lang")
  }

  get headElement(): HTMLHeadElement {
    return this.headSnapshot.element as HTMLHeadElement
  }

  get rootLocation(): URL {
    const root = this.getSetting("root") ?? "/"
    return expandURL(root)
  }

  get cacheControlValue(): string | null {
    return this.getSetting("cache-control")
  }

  get isPreviewable(): boolean {
    return this.cacheControlValue != "no-preview"
  }

  get isCacheable(): boolean {
    return this.cacheControlValue != "no-cache"
  }

  get isVisitable(): boolean {
    return this.getSetting("visit-control") != "reload"
  }

  get prefersViewTransitions(): boolean {
    return this.headSnapshot.getMetaValue("view-transition") === "same-origin"
  }

  get shouldMorphPage(): boolean {
    return this.getSetting("refresh-method") === "morph"
  }

  get shouldPreserveScrollPosition(): boolean {
    return this.getSetting("refresh-scroll") === "preserve"
  }

  private getSetting(name: string): string | null {
    return this.headSnapshot.getMetaValue(`turbo-${name}`)
  }
}
