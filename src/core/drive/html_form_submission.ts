import { Action } from "../types"
import { expandURL } from "../url"
import { getAttribute, getVisitAction } from "../../util"
import { FetchMethod, fetchMethodFromString } from "../../http/fetch_request"

export enum FormEnctype {
  urlEncoded = "application/x-www-form-urlencoded",
  multipart = "multipart/form-data",
  plain = "text/plain",
}

export function formEnctypeFromString(encoding: string): FormEnctype {
  switch (encoding.toLowerCase()) {
    case FormEnctype.multipart:
      return FormEnctype.multipart
    case FormEnctype.plain:
      return FormEnctype.plain
    default:
      return FormEnctype.urlEncoded
  }
}

export class HTMLFormSubmission {
  readonly location: URL

  constructor(readonly form: HTMLFormElement, readonly submitter?: HTMLElement) {
    const url = expandURL(this.action)

    this.location = this.isSafe ? mergeFormDataEntries(url, [...this.body.entries()]) : url
  }

  get method(): string {
    return this.submitter?.getAttribute("formmethod") || this.form.getAttribute("method") || ""
  }

  get fetchMethod(): FetchMethod {
    return fetchMethodFromString(this.method.toLowerCase()) || FetchMethod.get
  }

  get target(): string | null {
    if (this.submitter?.hasAttribute("formtarget") || this.form.hasAttribute("target")) {
      return this.submitter?.getAttribute("formtarget") || this.form.getAttribute("target")
    } else {
      return null
    }
  }

  get action(): string {
    const formElementAction = typeof this.form.action === "string" ? this.form.action : null

    if (this.submitter?.hasAttribute("formaction")) {
      return this.submitter.getAttribute("formaction") || ""
    } else {
      return this.form.getAttribute("action") || formElementAction || ""
    }
  }

  get formData(): FormData {
    const formData = new FormData(this.form)
    const name = this.submitter?.getAttribute("name")
    const value = this.submitter?.getAttribute("value")

    if (name) {
      formData.append(name, value || "")
    }

    return formData
  }

  get enctype(): FormEnctype {
    return formEnctypeFromString(this.submitter?.getAttribute("formenctype") || this.form.enctype)
  }

  get body(): URLSearchParams | FormData {
    if (this.enctype == FormEnctype.urlEncoded || this.fetchMethod == FetchMethod.get) {
      const formDataAsStrings = [...this.formData].reduce((entries, [name, value]) => {
        return entries.concat(typeof value == "string" ? [[name, value]] : [])
      }, [] as [string, string][])

      return new URLSearchParams(formDataAsStrings)
    } else {
      return this.formData
    }
  }

  get visitAction(): Action | null {
    return getVisitAction(this.submitter, this.form)
  }

  get frame(): string | null {
    return getAttribute("data-turbo-frame", this.submitter, this.form)
  }

  get isSafe(): boolean {
    return this.fetchMethod === FetchMethod.get
  }

  closest<E extends Element = Element>(selectors: string): E | null {
    return this.form.closest(selectors)
  }
}

function mergeFormDataEntries(url: URL, entries: [string, FormDataEntryValue][]): URL {
  const searchParams = new URLSearchParams()

  for (const [name, value] of entries) {
    if (value instanceof File) continue

    searchParams.append(name, value)
  }

  url.search = searchParams.toString()

  return url
}
