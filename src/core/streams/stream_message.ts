import { activateScriptElement, createDocumentFragment } from "../../util"

export class StreamMessage {
  static readonly contentType = "text/vnd.turbo-stream.html"
  readonly fragment: DocumentFragment
  readonly content: string | null

  static wrap(message: string | StreamMessage | { content: string } | null | undefined): any {
    if (message == null) {
      // Return an object with null content for null/undefined inputs
      return { content: null }
    } else if (message instanceof StreamMessage) {
      // Return StreamMessage instance as-is
      return message
    } else if (typeof message === "string") {
      // For string messages, return an object with the content property
      return { content: message }
    } else if (typeof message === "object" && "content" in message) {
      // For objects with content property, return as is
      return message
    } else {
      // Default case - create empty object with null content
      return { content: null }
    }
  }

  constructor(fragment: DocumentFragment | string) {
    if (typeof fragment === 'string') {
      this.fragment = importStreamElements(createDocumentFragment(fragment))
      this.content = fragment
    } else {
      this.fragment = importStreamElements(fragment)
      this.content = null
    }
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
