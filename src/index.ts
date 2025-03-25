import "./polyfills"
import "./elements"
import "./script_warning"
import { StreamActions } from "./core/streams/stream_actions"

import * as Turbo from "./core"

declare global {
  interface Window {
    Turbo: typeof Turbo & { StreamActions: typeof StreamActions }
  }
}

window.Turbo = { ...Turbo, StreamActions }
Turbo.start()

export { StreamActions }
export * from "./core"
export * from "./elements"
export * from "./http"
