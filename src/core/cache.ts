import { setMetaContent } from "../util"
import { Session } from "./session"

export class Cache {
  readonly session: Session

  constructor(session: Session) {
    this.session = session
  }

  clear(): void {
    this.session.clearCache()
  }

  resetCacheControl(): void {
    this.#setCacheControl("")
  }

  exemptPageFromCache(): void {
    this.#setCacheControl("no-cache")
  }

  exemptPageFromPreview(): void {
    this.#setCacheControl("no-preview")
  }

  #setCacheControl(value: string): void {
    setMetaContent("turbo-cache-control", value)
  }
}
