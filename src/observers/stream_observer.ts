import { FetchResponse } from "../http/fetch_response"
import { StreamMessage } from "../core/streams/stream_message"
import { StreamSource } from "../core/types"

export interface StreamDelegate {
  receivedMessageFromStream(message: StreamMessage): void
}

interface TurboBeforeFetchResponseEvent extends CustomEvent<{
  fetchResponse: FetchResponse
}> {}

// Declare the custom event to make TypeScript recognize it
declare global {
  interface WindowEventMap {
    'turbo:before-fetch-response': TurboBeforeFetchResponseEvent
  }
}

export class StreamObserver {
  readonly sources = new Set<StreamSource>()
  readonly delegate: StreamDelegate
  #started = false

  constructor(delegate: StreamDelegate) {
    this.delegate = delegate
  }

  start(): void {
    if (!this.#started) {
      this.#started = true
      addEventListener("turbo:before-fetch-response", this.inspectFetchResponse, false)
    }
  }

  stop(): void {
    if (this.#started) {
      this.#started = false
      removeEventListener("turbo:before-fetch-response", this.inspectFetchResponse, false)
    }
  }

  connectStreamSource(source: StreamSource): void {
    if (!this.streamSourceIsConnected(source)) {
      this.sources.add(source)
      if (source instanceof EventSource) {
        source.addEventListener("message", this.receiveMessageEvent as EventListener, false)
      } else if (source instanceof WebSocket) {
        source.addEventListener("message", this.receiveMessageEvent as EventListener, false)
      }
    }
  }

  disconnectStreamSource(source: StreamSource): void {
    if (this.streamSourceIsConnected(source)) {
      this.sources.delete(source)
      if (source instanceof EventSource) {
        source.removeEventListener("message", this.receiveMessageEvent as EventListener, false)
      } else if (source instanceof WebSocket) {
        source.removeEventListener("message", this.receiveMessageEvent as EventListener, false)
      }
    }
  }

  streamSourceIsConnected(source: StreamSource): boolean {
    return this.sources.has(source)
  }

  private inspectFetchResponse = (event: TurboBeforeFetchResponseEvent): void => {
    const response = fetchResponseFromEvent(event)
    if (response && fetchResponseIsStream(response)) {
      event.preventDefault()
      this.receiveMessageResponse(response)
    }
  }

  private receiveMessageEvent = (event: MessageEvent): void => {
    if (this.#started && typeof event.data == "string") {
      this.receiveMessageHTML(event.data)
    }
  }

  private async receiveMessageResponse(response: FetchResponse): Promise<void> {
    const html = await response.responseHTML
    if (html) {
      this.receiveMessageHTML(html)
    }
  }

  private receiveMessageHTML(html: string): void {
    this.delegate.receivedMessageFromStream(StreamMessage.wrap(html))
  }
}

function fetchResponseFromEvent(event: TurboBeforeFetchResponseEvent): FetchResponse | undefined {
  const fetchResponse = event.detail?.fetchResponse
  if (fetchResponse instanceof FetchResponse) {
    return fetchResponse
  }
  return undefined
}

function fetchResponseIsStream(response: FetchResponse): boolean {
  const contentType = response.contentType ?? ""
  return contentType.startsWith(StreamMessage.contentType)
}
