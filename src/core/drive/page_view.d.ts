import { View } from "../view"
import { PageSnapshot } from "./page_snapshot"
import { SnapshotCache } from "./snapshot_cache"
import { Visit } from "./visit"
import { Renderer } from "./renderer"

export interface PageViewDelegate extends View {
  viewWillCacheSnapshot(): void
}

export class PageView extends View {
  readonly snapshotCache: SnapshotCache
  lastRenderedLocation: URL
  forceReloaded: boolean
  delegate: PageViewDelegate

  shouldTransitionTo(newSnapshot: PageSnapshot): boolean

  renderPage(
    snapshot: PageSnapshot,
    isPreview?: boolean,
    willRender?: boolean,
    visit?: Visit
  ): Promise<void>

  renderError(snapshot: PageSnapshot, visit?: Visit): Promise<void>

  clearSnapshotCache(): void

  cacheSnapshot(snapshot?: PageSnapshot): Promise<PageSnapshot | undefined>

  getCachedSnapshotForLocation(location: URL): PageSnapshot | undefined

  isPageRefresh(visit?: Visit): boolean

  shouldPreserveScrollPosition(visit?: Visit): boolean

  get snapshot(): PageSnapshot
}
