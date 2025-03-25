import { Session } from "./session"
import { PageRenderer } from "./drive/page_renderer"
import { PageSnapshot } from "./drive/page_snapshot"
import { FrameRenderer } from "./frames/frame_renderer"
import { fetch, recentRequests } from "../http/fetch"
import { config } from "./config"
import { BrowserAdapter } from "./native/browser_adapter"
type Adapter = any // Temporary type for backward compatibility
import { StreamSource } from "./streams/stream_source"
import { StreamMessage } from "./streams/stream_message"

const session = new Session(recentRequests)
const { cache, navigator } = session

export { navigator, session, cache, PageRenderer, PageSnapshot, FrameRenderer, fetch, config }

interface VisitResponse {
  statusCode: number
  redirected: boolean
  responseHTML?: string
}

interface VisitOptions {
  action?: "restore" | "replace" | "advance"
  historyChanged?: boolean
  referrer?: string | URL
  snapshotHTML?: string
  response?: VisitResponse | undefined
}

/**
 * Starts the main session.
 * This initialises any necessary observers such as those to monitor
 * link interactions.
 */
export function start(): void {
  session.start()
}

/**
 * Registers an adapter for the main session.
 *
 * @param adapter Adapter to register
 */
export function registerAdapter(adapter: Adapter): void {
  session.registerAdapter(adapter)
}

/**
 * Performs an application visit to the given location.
 *
 * @param location Location to visit (a URL or path)
 * @param options Options to apply
 */
export function visit(location: string | URL, options: VisitOptions = {}): void {
  // Convert Response to VisitResponse if needed
  if (options.response && 'status' in options.response) {
    const response = options.response as unknown as Response
    const visitResponse: VisitResponse = {
      statusCode: response.status,
      redirected: response.redirected,
      responseHTML: undefined
    }
    options.response = visitResponse
  }
  session.visit(location, options)
}

/**
 * Connects a stream source to the main session.
 *
 * @param source Stream source to connect
 */
export function connectStreamSource(source: StreamSource): void {
  session.connectStreamSource(source)
}

/**
 * Disconnects a stream source from the main session.
 *
 * @param source Stream source to disconnect
 */
export function disconnectStreamSource(source: StreamSource): void {
  session.disconnectStreamSource(source)
}

/**
 * Renders a stream message to the main session by appending it to the
 * current document.
 *
 * @param message Message to render
 */
export function renderStreamMessage(message: StreamMessage): void {
  session.renderStreamMessage(message)
}

/**
 * Removes all entries from the Turbo Drive page cache.
 * Call this when state has changed on the server that may affect cached pages.
 *
 * @deprecated since version 7.2.0 in favor of `Turbo.cache.clear()`
 */
export function clearCache(): void {
  console.warn(
    'Turbo.clearCache() is deprecated and will be removed in a future version. Use Turbo.cache.clear() instead.'
  )
  session.clearCache()
}

/**
 * Sets the delay after which the progress bar will appear during navigation.
 *
 * The progress bar appears after 500ms by default.
 *
 * Note that this method has no effect when used with the iOS or Android
 * adapters.
 *
 * @param delay Time to delay in milliseconds
 */
export function setProgressBarDelay(delay: number): void {
  session.setProgressBarDelay(delay)
}

/**
 * Sets the confirmation method for potentially destructive actions.
 * 
 * @param confirmMethod Function that returns a Promise resolving to a boolean
 */
export function setConfirmMethod(confirmMethod: () => Promise<boolean>): void {
  session.setConfirmMethod(confirmMethod)
}

/**
 * Sets the form submission mode.
 * 
 * @param mode Form submission mode ("turbo", "optin", or "off")
 */
export function setFormMode(mode: "turbo" | "optin" | "off"): void {
  session.setFormMode(mode)
}

// Add URL.absoluteURL for backward compatibility
declare global {
  interface URL {
    absoluteURL: string
  }
}

// Extend URL prototype with absoluteURL property
Object.defineProperty(URL.prototype, 'absoluteURL', {
  get() { return this.toString() }
})
