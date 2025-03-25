import { queryAutofocusableElement } from "../util"

export class Snapshot {
  readonly element: Element

  constructor(element: Element) {
    this.element = element
  }

  get activeElement(): Element | null {
    return this.element.ownerDocument?.activeElement ?? null
  }

  get children(): Element[] {
    return [...this.element.children]
  }

  hasAnchor(anchor: string | null): boolean {
    return this.getElementForAnchor(anchor) != null
  }

  getElementForAnchor(anchor: string | null): HTMLElement | null {
    const element = anchor ? this.element.querySelector(`[id='${anchor}'], a[name='${anchor}']`) : null
    return element instanceof HTMLElement ? element : null
  }

  get isConnected(): boolean {
    return this.element.isConnected
  }

  get firstAutofocusableElement(): HTMLElement | null {
    const element = queryAutofocusableElement(this.element)
    return element instanceof HTMLElement ? element : null
  }

  get permanentElements(): NodeListOf<Element> {
    return queryPermanentElementsAll(this.element)
  }

  getPermanentElementById(id: string): Element | null {
    return getPermanentElementById(this.element, id)
  }

  getPermanentElementMapForSnapshot(snapshot: Snapshot): Map<string, Element[]> {
    const permanentElementMap = new Map<string, Element[]>()

    for (const currentPermanentElement of this.permanentElements) {
      const id = currentPermanentElement.id
      const newPermanentElement = snapshot.getPermanentElementById(id)
      if (newPermanentElement) {
        permanentElementMap.set(id, [currentPermanentElement, newPermanentElement])
      }
    }

    return permanentElementMap
  }
}

export function getPermanentElementById(node: Element | Document | DocumentFragment, id: string): Element | null {
  return node.querySelector(`#${id}[data-turbo-permanent]`)
}

export function queryPermanentElementsAll(node: Element | Document | DocumentFragment): NodeListOf<Element> {
  return node.querySelectorAll("[id][data-turbo-permanent]")
}
