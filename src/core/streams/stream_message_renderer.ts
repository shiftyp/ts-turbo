import { Bardo } from "../bardo"
import { getPermanentElementById, queryPermanentElementsAll } from "../snapshot"
import { around, elementIsFocusable, nextRepaint, queryAutofocusableElement, uuid } from "../../util"

interface StreamMessageRenderOptions {
  fragment: DocumentFragment
}

// Use Map<string, Element[]> to match Bardo's expected type

export class StreamMessageRenderer {
  render({ fragment }: StreamMessageRenderOptions): void {
    Bardo.preservingPermanentElements(this, getPermanentElementMapForFragment(fragment), () => {
      withAutofocusFromFragment(fragment, () => {
        withPreservedFocus(() => {
          document.documentElement.appendChild(fragment)
        })
      })
    })
  }

  // Bardo delegate
  enteringBardo(currentPermanentElement: Element, newPermanentElement: Element): void {
    newPermanentElement.replaceWith(currentPermanentElement.cloneNode(true))
  }

  leavingBardo(): void {}
}

function getPermanentElementMapForFragment(fragment: DocumentFragment): Map<string, Element[]> {
  const permanentElementsInDocument = queryPermanentElementsAll(document.documentElement)
  const permanentElementMap = new Map<string, Element[]>()

  for (const permanentElementInDocument of permanentElementsInDocument) {
    const { id } = permanentElementInDocument

    for (const streamElement of fragment.querySelectorAll("turbo-stream")) {
      const elementInStream = getPermanentElementById(
        (streamElement as HTMLElement & { templateElement: HTMLTemplateElement }).templateElement.content,
        id
      )

      if (elementInStream) {
        permanentElementMap.set(id, [permanentElementInDocument, elementInStream])
      }
    }
  }

  return permanentElementMap
}

async function withAutofocusFromFragment(fragment: DocumentFragment, callback: () => void): Promise<void> {
  const generatedID = `turbo-stream-autofocus-${uuid()}`
  const turboStreams = fragment.querySelectorAll("turbo-stream")
  const elementWithAutofocus = firstAutofocusableElementInStreams(turboStreams)
  let willAutofocusId: string | null = null

  if (elementWithAutofocus) {
    if (elementWithAutofocus.id) {
      willAutofocusId = elementWithAutofocus.id
    } else {
      willAutofocusId = generatedID
    }

    elementWithAutofocus.id = willAutofocusId
  }

  callback()
  await nextRepaint()

  const hasNoActiveElement = document.activeElement == null || document.activeElement == document.body

  if (hasNoActiveElement && willAutofocusId) {
    const elementToAutofocus = document.getElementById(willAutofocusId)

    if (elementToAutofocus && elementIsFocusable(elementToAutofocus)) {
      elementToAutofocus.focus()
    }
    if (elementToAutofocus && elementToAutofocus.id == generatedID) {
      elementToAutofocus.removeAttribute("id")
    }
  }
}

async function withPreservedFocus(callback: () => void): Promise<void> {
  const result = await around(async () => callback(), async () => document.activeElement) as unknown as [Element | null, Element | null]
  const activeElementBeforeRender = result[0]
  const activeElementAfterRender = result[1]

  const restoreFocusTo = activeElementBeforeRender && activeElementBeforeRender.id

  if (restoreFocusTo) {
    const elementToFocus = document.getElementById(restoreFocusTo)

    if (elementToFocus && elementIsFocusable(elementToFocus) && elementToFocus != activeElementAfterRender) {
      elementToFocus.focus()
    }
  }
}

function firstAutofocusableElementInStreams(nodeListOfStreamElements: NodeListOf<Element>): Element | null {
  for (const streamElement of nodeListOfStreamElements) {
    const elementWithAutofocus = queryAutofocusableElement(
      (streamElement as HTMLElement & { templateElement: HTMLTemplateElement }).templateElement.content
    )

    if (elementWithAutofocus) return elementWithAutofocus
  }

  return null
}
