import { PageView } from "./drive/page_view"
import { Visit } from "./drive/visit"
import { FormSubmission } from "./drive/form_submission"
import { History } from "./drive/history"

export interface VisitOptions {
  frame?: string
  action?: string
  shouldCacheSnapshot?: boolean
  response?: VisitResponse
  historyChanged?: boolean
  referrer?: string | URL
  snapshotHTML?: string
  direction?: 'forward' | 'back'
  restorationIdentifier?: string
}

export interface VisitResponse {
  statusCode: number
  responseHTML?: string
  redirected: boolean
}

export interface NavigatorDelegate {
  adapter: BrowserAdapter
  view: PageView
  history: History
  allowsVisitingLocationWithAction(location: URL, action?: string): boolean
  visitProposedToLocation(location: URL, options?: VisitOptions): void
  visitStarted(visit: Visit): void
  visitCompleted(visit: Visit): void
  visitScrolledToSamePageLocation(oldURL: URL, newURL: URL): void
}

// Define ReloadReason interface here to avoid circular dependencies
export interface ReloadReason {
  reason: string
  context?: {
    statusCode?: number
  }
}

export interface BrowserAdapter {
  formSubmissionStarted?(formSubmission: FormSubmission): void
  formSubmissionFinished?(formSubmission: FormSubmission): void
  linkPrefetchingIsEnabledForLocation?(location: URL): boolean
  pageInvalidated(reason: ReloadReason): void
  visitProposedToLocation(location: URL, options?: VisitOptions): void
  visitStarted(visit: Visit): void
  visitCompleted(visit: Visit): void
}

export interface HistoryDelegate {
  historyPoppedToLocationWithRestorationIdentifierAndDirection(
    location: URL,
    restorationIdentifier: string,
    direction: 'forward' | 'back'
  ): void
}

// Define a union type for stream sources that can be either EventSource or WebSocket
export type StreamSource = EventSource | WebSocket

export interface RestorationData {
  scrollPosition?: ScrollPosition
  [key: string]: any
}

export interface TurboHistoryState {
  turbo: {
    restorationIdentifier: string
    restorationIndex: number
  }
}

export interface ScrollPosition {
  x: number
  y: number
}

export interface TimingData {
  visitStart?: number
  requestStart?: number
  requestEnd?: number
  visitEnd?: number
}

export interface RenderOptions {
  resume: (value: unknown) => void
  render: () => Promise<void>
  renderMethod: string
}
