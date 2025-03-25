# Data Handling

> **Summary**: This section documents JavaScript-related issues discovered during the TypeScript migration related to data handling. The issues primarily involve null reference errors, unsafe type conversions, and improper data structure manipulation. The TypeScript migration improved data handling by adding proper null checking, type conversions, and safer data structure operations.

## 1. Null Reference Prevention

> **Summary**: This section addresses issues with null and undefined value handling. The original JavaScript code had potential null reference errors when manipulating collections and converting between data types. The TypeScript migration added explicit null checks and proper type conversions to prevent runtime errors.
- 🐛 Added null check for `oldestValue` in the `add` method to prevent errors when passing undefined values in [src/core/drive/limited_set.ts](src/core/drive/limited_set.ts)
  ```javascript
  // Before: No null check in JavaScript
  add(value) {
    if (this.size >= this.maxSize) {
      const iterator = this.values()
      const oldestValue = iterator.next().value
      this.delete(oldestValue) // Could fail if oldestValue is undefined
    }
    return super.add(value)
  }
  
  // After: With null check in TypeScript
  add(value: T): this {
    if (this.size >= this.maxSize) {
      const iterator = this.values()
      const oldestValue = iterator.next().value
      // Check that oldestValue exists before deleting
      if (oldestValue !== undefined) {
        this.delete(oldestValue)
      }
    }
    return super.add(value)
  }
  ```
- 🐛 Added proper handling for the `referrer` property conversion from string to URL in [src/core/drive/navigator.ts](src/core/drive/navigator.ts)
  ```javascript
  // Before: Unsafe URL handling in JavaScript
  startVisit(locatable, restorationIdentifier, options = {}) {
    this.stop()
    // Referrer could be a string or URL without type checking
    const referrer = options.referrer || this.location
    this.currentVisit = new Visit(this, expandURL(locatable), restorationIdentifier, {
      referrer: referrer, // Potential type mismatch
      // other options
    })
  }
  
  // After: Safe URL handling with proper type conversion in TypeScript
  startVisit(locatable: string | URL, restorationIdentifier?: string, options: VisitOptions = {}): void {
    this.stop()
    
    // Handle the referrer conversion
    let referrer: URL | undefined = this.location;
    if (options.referrer) {
      referrer = typeof options.referrer === 'string' ? new URL(options.referrer) : options.referrer;
    }
    
    // Create a visitOptions object with proper types
    const visitOptions: VisitOptionsFromVisit = {
      // other options
      referrer: referrer,
    };
  }
  ```
- 🐛 Added null checking in the `rootLocation` getter to prevent accessing properties of undefined objects in [src/core/drive/navigator.ts](src/core/drive/navigator.ts)
- 🐛 Fixed potential null reference errors when handling animation frames in [src/core/drive/visit.ts](src/core/drive/visit.ts)

## 2. Frame Controller Issues
- 🐛 Fixed duplicate property declarations and function implementations that could cause unexpected behavior in [src/core/frames/frame_controller.ts](src/core/frames/frame_controller.ts)
- 🐛 Fixed issues with the `action` property to ensure consistent behavior across navigation actions in [src/core/frames/frame_controller.ts](src/core/frames/frame_controller.ts)
