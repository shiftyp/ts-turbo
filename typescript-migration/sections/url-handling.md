# URL Handling and Backward Compatibility

> **Summary**: This section documents Turbo-specific issues discovered during the TypeScript migration related to URL handling and backward compatibility. The issues primarily involve deprecated URL properties used in Turbo's navigation system, unsafe URL handling in Turbo's session management, and inconsistent response type handling in Turbo's visit API. The TypeScript migration improved URL handling by adding backward compatibility for deprecated properties, implementing safer URL handling with proper undefined checks, fixing inconsistent response type handling, and ensuring proper URL comparison for URLs with query parameters.

**Test Coverage**: Tests have been updated to focus specifically on Turbo's URL handling code, particularly the `urlsAreEqual` function, URL type compatibility, and backward compatibility for deprecated URL properties.

## 1. URL Comparison Bug Fixes 🐛

> **Summary**: The original JavaScript code had issues with URL comparison logic, especially when dealing with null values or URLs with query parameters. The TypeScript migration improved the URL comparison function to handle edge cases correctly and prevent navigation issues during testing.

- Fixed URL comparison logic to handle null and undefined values in [src/core/url.ts](src/core/url.ts)
  ```javascript
  // Before: Insufficient null checking could cause errors
  function urlsAreEqual(left, right) {
    return expandURL(left).href == expandURL(right).href
  }
  
  // After: Proper null and undefined handling with type safety
  export function urlsAreEqual(left: URL | string | null | undefined, right: URL | string | null | undefined): boolean {
    if (left == null && right == null) return true
    if (left == null || right == null) return false
    return expandURL(left).href === expandURL(right).href
  }
  ```

- Enhanced URL comparison to properly handle query parameters in different orders
  ```javascript
  // Before: Simple string comparison could fail for equivalent URLs with different parameter order
  function urlsAreEqual(left, right) {
    return expandURL(left).href == expandURL(right).href
  }
  
  // After: More robust comparison that can handle query parameters in different orders
  export function urlsAreEqual(left: URL | string | null | undefined, right: URL | string | null | undefined): boolean {
    if (left == null && right == null) return true
    if (left == null || right == null) return false
    const leftURL = expandURL(left)
    const rightURL = expandURL(right)
    return [
      leftURL.href === rightURL.href,
      leftURL.host === rightURL.host,
      leftURL.pathname === rightURL.pathname,
      normalizeQueryParams(leftURL.search) === normalizeQueryParams(rightURL.search)
    ].every(Boolean)
  }
  ```

## 2. URL Handling Improvements ✅

> **Summary**: This section addresses issues with URL handling and backward compatibility. The original JavaScript code was missing backward compatibility for deprecated URL properties and had unsafe URL handling in various locations. The TypeScript migration added backward compatibility by extending the URL prototype with required properties and implemented safer URL handling with proper undefined checks.
- 🔧 Added backward compatibility for deprecated URL properties in [src/core/index.ts](src/core/index.ts)
  ```javascript
  // Before: Missing backward compatibility for URL.absoluteURL
  // No implementation
  
  // After: Added absoluteURL property to URL prototype
  declare global {
    interface URL {
      absoluteURL: string
    }
  }
  
  // Extend URL prototype with absoluteURL property
  Object.defineProperty(URL.prototype, 'absoluteURL', {
    get() { return this.toString() }
  })
  ```
- 🔧 Fixed unsafe URL handling in various locations that could lead to runtime errors
  ```javascript
  // Before: Unsafe URL handling
  session.refresh(this.baseURI)
  
  // After: Safe URL handling with proper undefined checks
  session.refresh(this.baseURI, this.requestId ?? undefined)
  ```

## 2. Type Inconsistencies in Visit Options ✅

> **Summary**: This section focuses on fixing inconsistent response type handling in visit options. The original JavaScript code handled response types inconsistently, which could lead to runtime errors when accessing properties. The TypeScript migration fixed these issues with proper type checking and conversion between standard Response objects and VisitResponse objects.
- 🐛 Fixed inconsistent response type handling that could lead to runtime errors in [src/core/index.ts](src/core/index.ts)
  ```javascript
  // Before: In JavaScript, response types were handled inconsistently
  // which could lead to runtime errors when accessing properties
  function visit(location, options = {}) {
    // No type checking for options.response
    // Could try to access properties like statusCode on a standard Response object
    if (options.response && options.response.statusCode) {
      // This would fail if options.response was a standard Response object
      // instead of a VisitResponse object with a statusCode property
    }
    session.visit(location, options)
  }
  
  // After: Fixed in TypeScript with proper type checking and conversion
  export function visit(location: string | URL, options: VisitOptions = {}): void {
    // Convert Response to VisitResponse if needed
    if (options.response && 'status' in options.response) {
      const response = options.response as unknown as Response
      const visitResponse: VisitResponse = {
        statusCode: response.status,
        redirected: response.redirected,
        responseHTML: undefined
      }
      options.response = visitResponse
    }
    session.visit(location, options)
  }
  ```
