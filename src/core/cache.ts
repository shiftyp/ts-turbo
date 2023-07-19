import { Session } from "./session"
import { setMetaContent } from "../util"
import { SnapshotCache } from "./drive/snapshot_cache"
import { CacheStore } from "./drive/cache_store"

export class Cache {
  readonly session: Session

  constructor(session: Session) {
    this.session = session
  }

  clear() {
    this.store.clear()
  }

  resetCacheControl() {
    this.setCacheControl("")
  }

  exemptPageFromCache() {
    this.setCacheControl("no-cache")
  }

  exemptPageFromPreview() {
    this.setCacheControl("no-preview")
  }

  set store(store: string | CacheStore) {
    if (typeof store === "string") {
      SnapshotCache.setStore(store)
    } else {
      SnapshotCache.currentStore = store
    }
  }

  get store(): CacheStore {
    return SnapshotCache.currentStore
  }

  private setCacheControl(value: string) {
    setMetaContent("turbo-cache-control", value)
  }
}
