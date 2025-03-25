export interface BardoDelegate {
  enteringBardo(currentPermanentElement: Element, newPermanentElement: Element): void
  leavingBardo(currentPermanentElement: Element): void
}

export class Bardo {
  readonly delegate: BardoDelegate
  readonly permanentElementMap: Map<string, Element[]>

  static async preservingPermanentElements(
    delegate: BardoDelegate,
    permanentElementMap: Map<string, Element[]>,
    callback: () => void | Promise<void>
  ): Promise<void> {
    const bardo = new this(delegate, permanentElementMap)
    bardo.enter()
    await callback()
    bardo.leave()
  }

  constructor(delegate: BardoDelegate, permanentElementMap: Map<string, Element[]>) {
    this.delegate = delegate
    this.permanentElementMap = permanentElementMap
  }

  enter(): void {
    for (const [id, [currentPermanentElement, newPermanentElement]] of this.permanentElementMap.entries()) {
      this.delegate.enteringBardo(currentPermanentElement, newPermanentElement)
      this.replaceNewPermanentElementWithPlaceholder(newPermanentElement)
    }
  }

  leave(): void {
    for (const [id, [currentPermanentElement]] of this.permanentElementMap.entries()) {
      this.replaceCurrentPermanentElementWithClone(currentPermanentElement)
      this.replacePlaceholderWithPermanentElement(currentPermanentElement)
      this.delegate.leavingBardo(currentPermanentElement)
    }
  }

  private replaceNewPermanentElementWithPlaceholder(permanentElement: Element): void {
    const placeholder = createPlaceholderForPermanentElement(permanentElement)
    permanentElement.replaceWith(placeholder)
  }

  private replaceCurrentPermanentElementWithClone(permanentElement: Element): void {
    const clone = permanentElement.cloneNode(true)
    permanentElement.replaceWith(clone)
  }

  private replacePlaceholderWithPermanentElement(permanentElement: Element): void {
    const placeholder = this.getPlaceholderById(permanentElement.id)
    placeholder?.replaceWith(permanentElement)
  }

  private getPlaceholderById(id: string): HTMLMetaElement | undefined {
    return this.placeholders.find((element) => element.content == id)
  }

  private get placeholders(): HTMLMetaElement[] {
    return [...document.querySelectorAll("meta[name=turbo-permanent-placeholder][content]")] as HTMLMetaElement[]
  }
}

function createPlaceholderForPermanentElement(permanentElement: Element): HTMLMetaElement {
  const element = document.createElement("meta")
  element.setAttribute("name", "turbo-permanent-placeholder")
  element.setAttribute("content", permanentElement.id)
  return element
}
