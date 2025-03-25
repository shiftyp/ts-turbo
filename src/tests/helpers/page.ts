import type { Page, Locator } from "@playwright/test"

export function attributeForSelector(page: Page, selector: string, attributeName: string): Promise<string | null> {
  return page.locator(selector).getAttribute(attributeName)
}

export function cancelNextEvent(page: Page, eventName: string): Promise<void> {
  return page.evaluate(
    (eventName) => addEventListener(eventName, (event) => event.preventDefault(), { once: true }),
    eventName
  )
}

export function clickWithoutScrolling(page: Page, selector: string, options: any = {}): Promise<boolean | void> {
  const element = page.locator(selector, options)

  return element.evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.click()
      return true
    }
    return false
  })
}

export function clearLocalStorage(page: Page): Promise<void> {
  return page.evaluate(() => localStorage.clear())
}

export function disposeAll(...handles: { dispose(): Promise<void> }[]): Promise<void[]> {
  return Promise.all(handles.map((handle) => handle.dispose()))
}

export function getComputedStyle(page: Page, selector: string, propertyName: string): Promise<string> {
  return page.evaluate(
    ([selector, propertyName]) => {
      const element = document.querySelector(selector)
      if (element) {
        const styles = window.getComputedStyle(element)
        return styles.getPropertyValue(propertyName)
      }
      return ''
    },
    [selector, propertyName]
  )
}

export function cssClassIsDefined(page: Page, className: string): Promise<boolean> {
  return page.evaluate((className) => {
    for (const stylesheet of document.styleSheets) {
      for (const rule of stylesheet.cssRules) {
        if (rule instanceof CSSStyleRule && rule.selectorText == `.${className}`) {
          return true
        }
      }
    }
    return false
  }, className)
}

export function getFromLocalStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((storageKey) => localStorage.getItem(storageKey), key)
}

export function hash(url: string): string {
  const link = document.createElement("a")
  link.href = url
  return link.hash
}

export function hasSelector(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).count().then(count => count > 0)
}

export function innerHTMLForSelector(page: Page, selector: string): Promise<string> {
  return page.locator(selector).innerHTML()
}

export function isScrolledToSelector(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((selector) => {
    const element = document.querySelector(selector)
    if (!element) return false

    const rect = element.getBoundingClientRect()
    const windowHeight = window.innerHeight || document.documentElement.clientHeight
    const windowWidth = window.innerWidth || document.documentElement.clientWidth
    const vertInView = rect.top <= windowHeight && rect.top + rect.height > 0
    const horInView = rect.left <= windowWidth && rect.left + rect.width > 0

    return vertInView && horInView
  }, selector)
}

export function nextBeat(): Promise<void> {
  return new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve())
  })
}

export function nextBody(_page: Page, timeout = 500): Promise<void> {
  return sleep(timeout)
}

export function nextPageRefresh(page: Page, timeout = 500): Promise<void> {
  return page.waitForLoadState("domcontentloaded", { timeout })
}

const timeout = 2000

export function nextEventNamed(page: Page, eventName: string, expectedDetail: Record<string, any> = {}): Promise<any> {
  return page.evaluate(
    ([eventName, expectedDetail]) => {
      return new Promise((resolve) => {
        function handler(event: any) {
          for (const [key, value] of Object.entries(expectedDetail)) {
            if (event.detail[key] !== value) return
          }
          window.removeEventListener(eventName as string, handler)
          resolve(event.detail)
        }
        window.addEventListener(eventName as string, handler)
      })
    },
    [eventName, expectedDetail]
  )
}

export function nextEventOnTarget(page: Page, elementId: string, eventName: string): Promise<any> {
  return page.evaluate(
    ([elementId, eventName]) => {
      return new Promise((resolve) => {
        const element = document.getElementById(elementId)
        if (!element) throw new Error(`Element #${elementId} not found`)
        element.addEventListener(eventName, ({ type }) => resolve({ type }), { once: true })
      })
    },
    [elementId, eventName]
  )
}

export function listenForEventOnTarget(page: Page, elementId: string, eventName: string): Promise<{ waiting: Promise<any> }> {
  return page.evaluate(
    ([elementId, eventName]) => {
      window.eventPromise = new Promise((resolve) => {
        const element = document.getElementById(elementId)
        if (!element) throw new Error(`Element #${elementId} not found`)
        element.addEventListener(eventName, ({ type }) => resolve({ type }), { once: true })
      })

      return { waiting: window.eventPromise }
    },
    [elementId, eventName]
  )
}

export function nextBodyMutation(page: Page): Promise<any> {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const observer = new MutationObserver((records) => {
        observer.disconnect()
        resolve(records[0])
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    })
  })
}

export function noNextBodyMutation(page: Page): Promise<void> {
  return Promise.race([nextBodyMutation(page), sleep(100).then(() => true)]).then(
    (result) => result === true ? Promise.resolve() : Promise.reject(new Error("unexpected mutation"))
  )
}

export function nextAttributeMutationNamed(page: Page, elementId: string, attributeName: string): Promise<any> {
  return page.evaluate(
    ([elementId, attributeName]) => {
      return new Promise((resolve) => {
        const element = document.getElementById(elementId)
        if (!element) throw new Error(`Element #${elementId} not found`)

        const observer = new MutationObserver((records) => {
          observer.disconnect()
          resolve(records[0])
        })
        observer.observe(element, { attributes: true, attributeFilter: [attributeName] })
      })
    },
    [elementId, attributeName]
  )
}

export function noNextAttributeMutationNamed(page: Page, elementId: string, attributeName: string): Promise<void> {
  return Promise.race([nextAttributeMutationNamed(page, elementId, attributeName), sleep(100).then(() => true)]).then(
    (result) => result === true ? Promise.resolve() : Promise.reject(new Error("unexpected attribute mutation"))
  )
}

export function noNextEventNamed(page: Page, eventName: string, expectedDetail: Record<string, any> = {}): Promise<void> {
  return Promise.race([nextEventNamed(page, eventName, expectedDetail), sleep(100).then(() => true)]).then(
    (result) => result === true ? Promise.resolve() : Promise.reject(new Error("unexpected event"))
  )
}

export function noNextEventOnTarget(page: Page, elementId: string, eventName: string): Promise<void> {
  return Promise.race([nextEventOnTarget(page, elementId, eventName), sleep(100).then(() => true)]).then(
    (result) => result === true ? Promise.resolve() : Promise.reject(new Error("unexpected event"))
  )
}

export function outerHTMLForSelector(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((element) => element.outerHTML)
}

export function pathname(url: string): string {
  const link = document.createElement("a")
  link.href = url
  return link.pathname
}

export function pathnameForIFrame(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (name) => {
      const iframe = document.querySelector(`iframe[name="${name}"]`) as HTMLIFrameElement
      if (!iframe) throw new Error(`No <iframe name="${name}"> element found`)

      return iframe.contentWindow ? iframe.contentWindow.location.pathname : ""
    },
    name
  )
}

export function propertyForSelector(page: Page, selector: string, propertyName: string): Promise<any> {
  return page.locator(selector).evaluate((element, propertyName) => (element as any)[propertyName], propertyName)
}

export function resetMutationLogs(page: Page): Promise<void> {
  return page.evaluate(() => {
    window.bodyMutations = []
    window.mutationEvents = []
    window.eventLogs = []
  })
}

export function readArray(page: Page, identifier: string, length: number): Promise<any[]> {
  return page.evaluate(
    ({ identifier, length }) => {
      const array = (window as any)[identifier]
      if (!array) return []

      if (length != null) {
        return array.slice(0, length)
      } else {
        return array
      }
    },
    { identifier, length }
  )
}

export function readBodyMutationLogs(page: Page, length: number): Promise<any[]> {
  return readArray(page, "bodyMutations", length)
}

export function readEventLogs(page: Page, length: number): Promise<any[]> {
  return readArray(page, "eventLogs", length)
}

export function readMutationLogs(page: Page, length: number): Promise<any[]> {
  return readArray(page, "mutationEvents", length)
}

export function refreshWithStream(page: Page): Promise<void> {
  return page.evaluate(() => {
    document.head.dispatchEvent(new CustomEvent("turbo:reload"))
    return undefined
  })
}

export function search(url: string): string {
  const link = document.createElement("a")
  link.href = url
  return link.search
}

export function searchParams(url: string): URLSearchParams {
  const link = document.createElement("a")
  link.href = url
  return new URLSearchParams(link.search)
}

export function selectorHasFocus(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((selector) => document.activeElement === document.querySelector(selector), selector)
}

export function setLocalStorageFromEvent(page: Page, eventName: string, storageKey: string, storageValue: string): Promise<void> {
  return page.evaluate(
    ([eventName, storageKey, storageValue]) => {
      document.addEventListener(eventName, () => localStorage.setItem(storageKey, storageValue), { once: true })
    },
    [eventName, storageKey, storageValue]
  )
}

export function scrollPosition(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
}

export function isScrolledToTop(page: Page): Promise<boolean> {
  return scrollPosition(page).then(({ y }) => y === 0)
}

export function scrollToSelector(page: Page, selector: string): Promise<void> {
  return page.locator(selector).scrollIntoViewIfNeeded()
}

export function sleep(timeout = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(undefined), timeout))
}

export function strictElementEquals(left: Node | null, right: Node | null): boolean {
  return left === right
}

export function textContent(page: Page, html: string): Promise<string> {
  return page.evaluate((html) => {
    const element = document.createElement("div")
    element.innerHTML = html
    return element.textContent || ""
  }, html)
}

export function visitAction(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const action = document.querySelector("meta[name='turbo-visit-control']")?.getAttribute("content")
    if (action === "reload") {
      return "reload"
    } else if (action === "replace") {
      return "replace"
    }
    return undefined
  })
}

export function waitForPathname(page: Page, pathname: string): Promise<void> {
  return page.waitForURL(url => url.pathname === pathname).then(() => {})
}

export function waitUntilText(page: Page, text: string, state = "visible"): Promise<void> {
  return page.waitForSelector(`text=${text}`, { state: state as any }).then(() => {})
}

export function waitUntilSelector(page: Page, selector: string, state = "visible"): Promise<void> {
  return page.waitForSelector(selector, { state: state as any }).then(() => {})
}

export function waitUntilNoSelector(page: Page, selector: string, state = "hidden"): Promise<void> {
  return page.waitForSelector(selector, { state: state as any }).then(() => {})
}

export function willChangeBody(page: Page, callback: () => Promise<void>): Promise<any> {
  return page
    .evaluate(() => {
      return new Promise((resolve) => {
        const observer = new MutationObserver((records) => {
          observer.disconnect()
          resolve(records[0])
        })
        observer.observe(document.body, { childList: true, subtree: true })
      })
    })
    .then((result) => {
      callback()
      return result
    })
}

// Add type augmentation for global window object
declare global {
  interface Window {
    bodyMutations: any[]
    mutationEvents: any[]
    eventLogs: any[]
    eventPromise: Promise<any>
  }
}
