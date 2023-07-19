import { toCacheKey } from "../../url"
import { PageSnapshot } from "../page_snapshot"
import { CacheStore } from "../cache_store"

export class MemoryStore extends CacheStore {
  readonly keys: string[] = []
  readonly size: number
  snapshots: { [url: string]: PageSnapshot } = {}

  constructor(size: number) {
    super()
    this.size = size
  }

  async has(location: URL) {
    return toCacheKey(location) in this.snapshots
  }

  async get(location: URL): Promise<PageSnapshot | undefined> {
    if (await this.has(location)) {
      const snapshot = this.read(location)
      this.touch(location)
      return snapshot
    }
  }

  async put(location: URL, snapshot: PageSnapshot): Promise<PageSnapshot> {
    this.write(location, snapshot)
    this.touch(location)
    return snapshot
  }

  async clear() {
    this.snapshots = {}
  }

  // Private

  read(location: URL) {
    return this.snapshots[toCacheKey(location)]
  }

  write(location: URL, snapshot: PageSnapshot) {
    this.snapshots[toCacheKey(location)] = snapshot
  }

  touch(location: URL) {
    const key = toCacheKey(location)
    const index = this.keys.indexOf(key)
    if (index > -1) this.keys.splice(index, 1)
    this.keys.unshift(key)
    this.trim()
  }

  trim() {
    for (const key of this.keys.splice(this.size)) {
      delete this.snapshots[key]
    }
  }
}
