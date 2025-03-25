import { activateScriptElement, createDocumentFragment } from "../../util"

export class StreamMessage {
  static readonly contentType = "text/vnd.turbo-stream.html"
  readonly fragment: DocumentFragment

  static wrap(message: string | StreamMessage): StreamMessage {
    if (typeof message === "string") {
      return new this(createDocumentFragment(message))
    } else {
      return message
    }
  }

  constructor(fragment: DocumentFragment) {
    this.fragment = importStreamElements(fragment)
  }
}

// Define a type for the turbo-stream element to ensure TypeScript recognizes its properties
interface TurboStreamElement extends HTMLElement {
  templateElement: HTMLTemplateElement;
}

function importStreamElements(fragment: DocumentFragment): DocumentFragment {
  for (const element of fragment.querySelectorAll("turbo-stream")) {
    // Cast the imported node to our custom element type
    const streamElement = document.importNode(element, true) as TurboStreamElement

    for (const inertScriptElement of streamElement.templateElement.content.querySelectorAll("script")) {
      inertScriptElement.replaceWith(activateScriptElement(inertScriptElement))
    }

    element.replaceWith(streamElement)
  }

  return fragment
}
