import { toCacheKey } from "../url"
import { PageSnapshot } from "./page_snapshot"

export class SnapshotCache {
  private readonly keys: string[] = []
  private readonly snapshots: Record<string, PageSnapshot> = {}
  private readonly size: number

  constructor(size: number) {
    this.size = size
  }

  has(location: URL): boolean {
    return toCacheKey(location) in this.snapshots
  }

  get(location: URL): PageSnapshot | undefined {
    if (this.has(location)) {
      const snapshot = this.read(location)
      this.touch(location)
      return snapshot
    }
  }

  put(location: URL, snapshot: PageSnapshot): PageSnapshot {
    this.write(location, snapshot)
    this.touch(location)
    return snapshot
  }

  clear(): void {
    // Clear the snapshots object by deleting each key instead of reassigning
    Object.keys(this.snapshots).forEach(key => {
      delete this.snapshots[key];
    })
    // Also clear the keys array
    this.keys.length = 0
  }

  // Private

  private read(location: URL): PageSnapshot {
    return this.snapshots[toCacheKey(location)]
  }

  private write(location: URL, snapshot: PageSnapshot): void {
    this.snapshots[toCacheKey(location)] = snapshot
  }

  private touch(location: URL): void {
    const key = toCacheKey(location)
    const index = this.keys.indexOf(key)
    if (index > -1) this.keys.splice(index, 1)
    this.keys.unshift(key)
    this.trim()
  }

  private trim(): void {
    for (const key of this.keys.splice(this.size)) {
      delete this.snapshots[key]
    }
  }
}
