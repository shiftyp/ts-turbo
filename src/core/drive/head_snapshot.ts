import { Snapshot } from "../snapshot"

interface ElementDetails {
  type: ElementType | undefined
  tracked: boolean
  elements: Element[]
}

type ElementType = "script" | "stylesheet"

interface DetailsByOuterHTML {
  [outerHTML: string]: ElementDetails
}

export class HeadSnapshot extends Snapshot {
  readonly detailsByOuterHTML: DetailsByOuterHTML = this.children
    .filter((element) => !elementIsNoscript(element))
    .map((element) => elementWithoutNonce(element))
    .reduce((result, element) => {
      const { outerHTML } = element
      const details =
        outerHTML in result
          ? result[outerHTML]
          : {
              type: elementType(element),
              tracked: elementIsTracked(element),
              elements: []
            }
      return {
        ...result,
        [outerHTML]: {
          ...details,
          elements: [...details.elements, element]
        }
      }
    }, {} as DetailsByOuterHTML)

  get trackedElementSignature(): string {
    return Object.keys(this.detailsByOuterHTML)
      .filter((outerHTML) => this.detailsByOuterHTML[outerHTML].tracked)
      .join("")
  }

  getScriptElementsNotInSnapshot(snapshot: HeadSnapshot): Element[] {
    return this.getElementsMatchingTypeNotInSnapshot("script", snapshot)
  }

  getStylesheetElementsNotInSnapshot(snapshot: HeadSnapshot): Element[] {
    return this.getElementsMatchingTypeNotInSnapshot("stylesheet", snapshot)
  }

  private getElementsMatchingTypeNotInSnapshot(matchedType: ElementType, snapshot: HeadSnapshot): Element[] {
    return Object.keys(this.detailsByOuterHTML)
      .filter((outerHTML) => !(outerHTML in snapshot.detailsByOuterHTML))
      .map((outerHTML) => this.detailsByOuterHTML[outerHTML])
      .filter(({ type }) => type == matchedType)
      .map(({ elements: [element] }) => element)
  }

  get provisionalElements(): Element[] {
    return Object.keys(this.detailsByOuterHTML).reduce((result: Element[], outerHTML) => {
      const { type, tracked, elements } = this.detailsByOuterHTML[outerHTML]
      if (type == null && !tracked) {
        return [...result, ...elements]
      } else if (elements.length > 1) {
        return [...result, ...elements.slice(1)]
      } else {
        return result
      }
    }, [])
  }

  getMetaValue(name: string): string | null {
    const element = this.findMetaElementByName(name)
    return element ? element.getAttribute("content") : null
  }

  findMetaElementByName(name: string): Element | undefined {
    return Object.keys(this.detailsByOuterHTML).reduce((result: Element | undefined, outerHTML) => {
      const {
        elements: [element]
      } = this.detailsByOuterHTML[outerHTML]
      return elementIsMetaElementWithName(element, name) ? element : result
    }, undefined)
  }
}

function elementType(element: Element): ElementType | undefined {
  if (elementIsScript(element)) {
    return "script"
  } else if (elementIsStylesheet(element)) {
    return "stylesheet"
  }
  return undefined
}

function elementIsTracked(element: Element): boolean {
  return element.getAttribute("data-turbo-track") == "reload"
}

function elementIsScript(element: Element): boolean {
  const tagName = element.localName
  return tagName == "script"
}

function elementIsNoscript(element: Element): boolean {
  const tagName = element.localName
  return tagName == "noscript"
}

function elementIsStylesheet(element: Element): boolean {
  const tagName = element.localName
  return tagName == "style" || (tagName == "link" && element.getAttribute("rel") == "stylesheet")
}

function elementIsMetaElementWithName(element: Element, name: string): boolean {
  const tagName = element.localName
  return tagName == "meta" && element.getAttribute("name") == name
}

function elementWithoutNonce(element: Element): Element {
  if (element.hasAttribute("nonce")) {
    element.setAttribute("nonce", "")
  }
  return element
}
