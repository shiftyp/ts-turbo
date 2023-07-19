import { PageSnapshot } from "./page_snapshot"

export abstract class CacheStore {
  abstract has(location: URL): Promise<boolean>
  abstract get(location: URL): Promise<PageSnapshot | undefined>
  abstract put(location: URL, snapshot: PageSnapshot): Promise<PageSnapshot>
  abstract clear(): Promise<void>
}
