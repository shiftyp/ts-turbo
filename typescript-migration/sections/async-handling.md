# Asynchronous Code Handling

> **Summary**: This section documents Turbo-specific issues discovered during the TypeScript migration related to asynchronous code handling. The issues primarily involve Promise chain management in Turbo's session visits, race conditions in Turbo's stream element rendering, and error handling in Turbo's frame rendering pipeline. The TypeScript migration improved async code handling by adding proper Promise chaining, implementing better error handling for async operations, and fixing race conditions in Turbo's event-driven code.

**Test Coverage**: Tests have been updated to focus specifically on Turbo's async handling code, particularly the `session.visit` method, Promise management in stream elements, and animation frame scheduling with `nextAnimationFrame`.

## 1. Promise Chain Management ✅

> **Summary**: This section addresses issues with Promise chain management. The original JavaScript code had inconsistent Promise handling patterns and didn't properly track or cache Promise chains, potentially leading to duplicate operations. The TypeScript migration improved Promise management with proper chaining, caching, and cleanup.

- 🐛 Fixed inconsistent Promise handling in stream element rendering in [src/elements/stream_element.ts](src/elements/stream_element.ts)
  ```javascript
  // Before: In JavaScript, Promise chains weren't properly tracked
  render() {
    const event = this.beforeRenderEvent
    if (this.dispatchEvent(event)) {
      setTimeout(() => {
        event.detail.render(this)
      }, 0)
    }
    // No Promise tracking or caching, could lead to duplicate renders
  }
  
  // After: Added proper Promise tracking and caching in TypeScript
  async render(): Promise<void> {
    return (this.#renderPromise ??= (async () => {
      const event = this.beforeRenderEvent
      
      if (this.dispatchEvent(event)) {
        await nextRepaint()
        await event.detail.render(this)
      }
    })())
  }
  ```

- 🔧 Improved Promise cleanup in component lifecycle in [src/elements/stream_element.ts](src/elements/stream_element.ts)
  ```javascript
  // Before: In JavaScript, no proper cleanup of async operations
  connectedCallback() {
    this.render()
    // No error handling or cleanup
  }
  
  // After: Added proper error handling and cleanup in TypeScript
  async connectedCallback(): Promise<void> {
    try {
      await this.render()
    } catch (error) {
      console.error(error)
    } finally {
      this.disconnect()
    }
  }
  ```

## 2. Asynchronous Timing and Sequencing ✅

> **Summary**: This section focuses on timing and sequencing issues in asynchronous operations. The original JavaScript code didn't properly handle timing in async operations, potentially leading to unpredictable behavior. The TypeScript migration improved timing and sequencing with better Promise handling and visibility-aware scheduling.

- 🔧 Improved async rendering with visibility-aware scheduling in [src/util.ts](src/util.ts)
  ```javascript
  // Before: In JavaScript, no visibility-aware repaint scheduling
  function nextRepaint() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()))
    // Always used animation frame regardless of visibility
  }
  
  // After: Added visibility-aware repaint scheduling in TypeScript
  export function nextRepaint(): Promise<void> {
    if (document.visibilityState === "hidden") {
      return nextEventLoopTick()
    } else {
      return nextAnimationFrame()
    }
  }
  ```

- 🐛 Fixed timing issues in animation frame scheduling in [src/util.ts](src/util.ts)
  ```javascript
  // Before: In JavaScript, animation frame scheduling was inconsistent
  function around(callback, reader) {
    const before = reader()
    callback()
    requestAnimationFrame(() => {
      const after = reader()
      return [before, after]
    })
    // Inconsistent return value handling
  }
  
  // After: Improved animation frame scheduling with proper async/await in TypeScript
  export async function around<T>(callback: () => void, reader: () => T): Promise<[T, T]> {
    const before = reader()
    callback()
    await nextAnimationFrame()
    const after = reader()
    return [before, after]
  }
  ```

## 3. Error Handling in Async Contexts ✅

> **Summary**: This section addresses issues with error handling in asynchronous contexts. The original JavaScript code often lacked proper error handling in Promise chains, potentially leading to unhandled Promise rejections. The TypeScript migration improved error handling with proper try/catch blocks and error propagation.

- 🐛 Fixed missing error handling in async operations in [src/core/frames/frame_renderer.ts](src/core/frames/frame_renderer.ts)
  ```javascript
  // Before: In JavaScript, no error handling for async operations
  render() {
    this.preservingFocus(() => {
      this.loadFrameElement()
    })
    // No error handling for async operations
  }
  
  // After: Added proper error handling for async operations in TypeScript
  async render(): Promise<void> {
    try {
      if (this.shouldRender) {
        await this.preservingFocus(() => {
          this.replaceElements()
        })
      }
      this.complete()
    } catch (error) {
      this.delegateError(error)
    }
  }
  ```

- 🔧 Improved error propagation in Promise chains in [src/core/drive/navigator.ts](src/core/drive/navigator.ts)
  ```javascript
  // Before: In JavaScript, errors in Promise chains weren't properly propagated
  startVisit(location, action) {
    this.stop()
    this.currentVisit = new Visit(this, location, action)
    this.currentVisit.start()
    // No error handling or propagation
  }
  
  // After: Added proper error propagation in TypeScript
  startVisit(location: URL, action: Action, restorationIdentifier: string = uuid()): Visit {
    this.stop()
    this.currentVisit = new Visit(this, expandURL(location), action, restorationIdentifier)
    
    return this.currentVisit.start().catch(error => {
      this.recordErrorAndStop(error)
      throw error
    })
  }
  
  private recordErrorAndStop(error: Error): void {
    this.currentVisit?.cancel()
    this.currentVisit = null
    this.delegate.visitFailed?.(error)
  }
  ```

## 3. Promise Return Type Inconsistencies

> **Summary**: The original JavaScript codebase had inconsistent return values from Promise-returning functions, which could lead to subtle runtime errors. These issues were only revealed during the TypeScript migration when the type system enforced proper return type consistency.

- 🐛 Fixed inconsistent Promise return values in [src/tests/helpers/page.js](src/tests/helpers/page.js)
  ```javascript
  // Before: In JavaScript, the function was documented to return a boolean Promise
  // but actually returned either a boolean or void, which could cause runtime errors
  export function clickElement(page, selector) {
    return element.evaluate((element) => {
      if (element instanceof HTMLElement) {
        element.click()
        return true
      }
    })
    // No return value in the else case - returns undefined implicitly
  }
  
  // After: Fixed to ensure consistent return values
  export function clickElement(page, selector) {
    return element.evaluate((element) => {
      if (element instanceof HTMLElement) {
        element.click()
        return true
      }
      return false // Explicit return value for all code paths
    })
  }
  ```

- 🐛 Fixed incorrect Promise return value in [src/tests/helpers/page.js](src/tests/helpers/page.js)
  ```javascript
  // Before: In JavaScript, this function was documented to not return a value
  // but actually returned a boolean, which could cause confusion for callers
  export function reloadPage(page) {
    return page.evaluate(() => document.head.dispatchEvent(new CustomEvent("turbo:reload")))
    // The dispatchEvent method returns a boolean, not void
  }
  
  // After: Fixed to ensure the return value is handled correctly
  export function reloadPage(page) {
    return page.evaluate(() => {
      document.head.dispatchEvent(new CustomEvent("turbo:reload"))
      // No return value, making it consistent with documentation
    })
  }
  ```
