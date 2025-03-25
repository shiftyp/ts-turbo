import { expandURL } from "../core/url"

export class FetchResponse {
  readonly response: Response

  constructor(response: Response) {
    this.response = response
  }

  get succeeded(): boolean {
    return this.response.ok
  }

  get failed(): boolean {
    return !this.succeeded
  }

  get clientError(): boolean {
    return this.statusCode >= 400 && this.statusCode <= 499
  }

  get serverError(): boolean {
    return this.statusCode >= 500 && this.statusCode <= 599
  }

  get redirected(): boolean {
    return this.response.redirected
  }

  get location(): URL {
    return expandURL(this.response.url)
  }

  get isHTML(): boolean {
    return Boolean(this.contentType && this.contentType.match(/^(?:text\/([^\s;,]+\b)?html|application\/xhtml\+xml)\b/))
  }

  get statusCode(): number {
    return this.response.status
  }

  get contentType(): string | null {
    return this.header("Content-Type")
  }

  get responseText(): Promise<string> {
    return this.response.clone().text()
  }

  get responseHTML(): Promise<string | undefined> {
    if (this.isHTML) {
      return this.response.clone().text()
    } else {
      return Promise.resolve(undefined)
    }
  }

  header(name: string): string | null {
    return this.response.headers.get(name)
  }
}
