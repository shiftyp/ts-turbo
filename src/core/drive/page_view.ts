import { nextEventLoopTick } from "../../util"
import { View, ViewDelegate } from "../view"
import { ErrorRenderer } from "./error_renderer"
import { MorphingPageRenderer } from "./morphing_page_renderer"
import { PageRenderer } from "./page_renderer"
import { PageSnapshot } from "./page_snapshot"
import { SnapshotCache } from "./snapshot_cache"
import { Visit } from "./visit"
import { Snapshot } from "../snapshot"

export interface PageViewDelegate extends ViewDelegate {
  viewWillCacheSnapshot(): void
}

export class PageView extends View {
  readonly snapshotCache = new SnapshotCache(10)
  lastRenderedLocation = new URL(location.href)
  forceReloaded = false
  readonly delegate!: PageViewDelegate
  
  constructor(delegate: PageViewDelegate, element: Element) {
    super(delegate, element)
    // Initialize the snapshot property to avoid undefined errors
    this.snapshot = PageSnapshot.fromElement(this.element)
  }

  shouldTransitionTo(newSnapshot: PageSnapshot): boolean {
    return this.snapshot?.prefersViewTransitions && newSnapshot.prefersViewTransitions || false
  }

  renderPage(snapshot: PageSnapshot, isPreview = false, willRender = true, visit?: Visit): Promise<void> {
    // Ensure we have a valid snapshot before proceeding
    if (!this.snapshot) {
      this.snapshot = PageSnapshot.fromElement(this.element)
    }
    
    // Since we just validated this.snapshot exists, we can use the non-null assertion
    const currentSnapshot = this.snapshot as PageSnapshot
    
    const shouldMorphPage = this.isPageRefresh(visit) && currentSnapshot.shouldMorphPage
    const rendererClass = shouldMorphPage ? MorphingPageRenderer : PageRenderer

    const renderer = new rendererClass(currentSnapshot, snapshot, isPreview, willRender)

    if (!renderer.shouldRender) {
      this.forceReloaded = true
    } else {
      visit?.changeHistory()
    }

    return this.render(renderer)
  }

  renderError(snapshot: PageSnapshot, visit?: Visit): Promise<void> {
    visit?.changeHistory()
    // Ensure we have a valid snapshot
    if (!this.snapshot) {
      this.snapshot = PageSnapshot.fromElement(this.element)
    }
    // Use type assertion to ensure compatibility
    const currentSnapshot = this.snapshot as PageSnapshot
    const renderer = new ErrorRenderer(currentSnapshot, snapshot, false)
    return this.render(renderer)
  }

  clearSnapshotCache(): void {
    this.snapshotCache.clear()
  }

  async cacheSnapshot(snapshot?: PageSnapshot): Promise<PageSnapshot | undefined> {
    // Ensure we have a valid snapshot to use
    if (!snapshot) {
      if (!this.snapshot) {
        this.snapshot = PageSnapshot.fromElement(this.element)
      }
      snapshot = this.snapshot as PageSnapshot
    }
    if (snapshot.isCacheable) {
      this.delegate.viewWillCacheSnapshot()
      const { lastRenderedLocation: location } = this
      await nextEventLoopTick()
      const cachedSnapshot = snapshot.clone()
      this.snapshotCache.put(location, cachedSnapshot)
      return cachedSnapshot
    }
  }

  getCachedSnapshotForLocation(location: URL): PageSnapshot | undefined {
    return this.snapshotCache.get(location)
  }

  isPageRefresh(visit?: Visit): boolean {
    return !visit || (this.lastRenderedLocation.pathname === visit.location.pathname && visit.action === "replace")
  }

  shouldPreserveScrollPosition(visit?: Visit): boolean {
    return this.isPageRefresh(visit) && this.snapshot?.shouldPreserveScrollPosition || false
  }

  // Redefine the snapshot property from the base class with the correct type
  override snapshot?: PageSnapshot
  
  // Provide a safe getter that always returns a valid PageSnapshot
  get pageSnapshot(): PageSnapshot {
    if (!this.snapshot) {
      this.snapshot = PageSnapshot.fromElement(this.element)
    }
    return this.snapshot
  }
}
