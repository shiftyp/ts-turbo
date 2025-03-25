import { Snapshot } from "../snapshot"
import { View } from "../view"

export class FrameView extends View {
  missing(): void {
    this.element.innerHTML = `<strong class="turbo-frame-error">Content missing</strong>`
  }

  // Override the snapshot property from the base class
  // Instead of using an accessor, we'll use a method to avoid the TypeScript error
  getSnapshot(): Snapshot {
    return new Snapshot(this.element)
  }
}
