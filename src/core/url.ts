import { config } from "./config"

type Locatable = string | URL

export function expandURL(locatable: Locatable): URL {
  return new URL(locatable.toString(), document.baseURI)
}

export function getAnchor(url: URL): string | undefined {
  let anchorMatch: RegExpMatchArray | null
  if (url.hash) {
    return url.hash.slice(1)
  } else if ((anchorMatch = url.href.match(/#(.*)$/))) {
    return anchorMatch[1]
  }
  return undefined
}

export function getAction(form: HTMLFormElement, submitter?: HTMLElement | null): URL {
  const action = submitter?.getAttribute("formaction") || form.getAttribute("action") || form.action
  return expandURL(action)
}

export function getExtension(url: URL): string {
  return (getLastPathComponent(url).match(/\.[^.]*$/) || [])[0] || ""
}

export function isPrefixedBy(baseURL: URL, url: Locatable): boolean {
  const prefix = getPrefix(url)
  return baseURL.href === expandURL(prefix).href || baseURL.href.startsWith(prefix)
}

export function locationIsVisitable(location: URL, rootLocation: Locatable): boolean {
  return isPrefixedBy(location, rootLocation) && !config.drive.unvisitableExtensions.has(getExtension(location))
}

export function getRequestURL(url: URL): string {
  const anchor = getAnchor(url)
  return anchor != null ? url.href.slice(0, -(anchor.length + 1)) : url.href
}

export function toCacheKey(url: URL): string {
  return getRequestURL(url)
}

export function urlsAreEqual(left: Locatable | null | undefined, right: Locatable | null | undefined): boolean {
  // Handle null and undefined cases
  if (left === null && right === null) return true
  if (left === undefined && right === undefined) return true
  if (left == null || right == null) return false
  
  const leftURL = expandURL(left)
  const rightURL = expandURL(right)
  
  // Compare protocol, host, pathname without query parameters
  if (leftURL.origin !== rightURL.origin || leftURL.pathname !== rightURL.pathname) {
    return false
  }
  
  // Compare query parameters (order-independent)
  const leftParams = new URLSearchParams(leftURL.search)
  const rightParams = new URLSearchParams(rightURL.search)
  
  // Check if the number of parameters matches
  if ([...leftParams.keys()].length !== [...rightParams.keys()].length) {
    return false
  }
  
  // Check if all parameters in leftParams exist with the same value in rightParams
  for (const [key, value] of leftParams.entries()) {
    if (rightParams.get(key) !== value) {
      return false
    }
  }
  
  // Compare hash
  return leftURL.hash === rightURL.hash
}

function getPathComponents(url: URL | Locatable): string[] {
  return expandURL(url).pathname.split("/").slice(1)
}

function getLastPathComponent(url: URL | Locatable): string {
  return getPathComponents(url).slice(-1)[0]
}

function getPrefix(url: URL | Locatable): string {
  const expanded = expandURL(url)
  return addTrailingSlash(expanded.origin + expanded.pathname)
}

function addTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : value + "/"
}
