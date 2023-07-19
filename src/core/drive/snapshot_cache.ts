import { PageSnapshot } from "./page_snapshot"
import { CacheStore } from "./cache_store"
import { DiskStore } from "./cache_stores/disk_store"
import { MemoryStore } from "./cache_stores/memory_store"

export class SnapshotCache {
  static currentStore: CacheStore = new MemoryStore(10)

  static setStore(storeName: string) {
    switch (storeName) {
      case "memory":
        SnapshotCache.currentStore = new MemoryStore(10)
        break
      case "disk":
        SnapshotCache.currentStore = new DiskStore()
        break
      default:
        throw new Error(`Invalid store name: ${storeName}`)
    }
  }

  has(location: URL) {
    return SnapshotCache.currentStore.has(location)
  }

  get(location: URL) {
    return SnapshotCache.currentStore.get(location)
  }

  put(location: URL, snapshot: PageSnapshot) {
    return SnapshotCache.currentStore.put(location, snapshot)
  }

  clear() {
    return SnapshotCache.currentStore.clear()
  }
}
