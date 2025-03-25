import { cancelEvent } from "../../util"

interface SubmitterHandler {
  beforeSubmit(submitter: HTMLElement): void
  afterSubmit(submitter: HTMLElement): void
}

interface SubmitterHandlers {
  [key: string]: SubmitterHandler
}

const submitter: SubmitterHandlers = {
  "aria-disabled": {
    beforeSubmit: (submitter: HTMLElement) => {
      submitter.setAttribute("aria-disabled", "true")
      submitter.addEventListener("click", cancelEvent)
    },

    afterSubmit: (submitter: HTMLElement) => {
      submitter.removeAttribute("aria-disabled")
      submitter.removeEventListener("click", cancelEvent)
    }
  },

  "disabled": {
    beforeSubmit: (submitter: HTMLButtonElement | HTMLInputElement) => submitter.disabled = true,
    afterSubmit: (submitter: HTMLButtonElement | HTMLInputElement) => submitter.disabled = false
  }
}

interface ConfigOptions {
  mode: string
  formMode: string
  submitter: string | SubmitterHandler | null
  submitSelector?: string
  submitterSelector?: string
}

class Config implements ConfigOptions {
  mode: string = "on"
  formMode: string = "turbo"
  submitSelector: string = "form[data-turbo='true']"
  submitterSelector: string = "button,input[type=submit],input[type=image]"
  #submitter: SubmitterHandler | null = null

  constructor(config: ConfigOptions) {
    Object.assign(this, config)
  }

  get submitter(): string | SubmitterHandler | null {
    return this.#submitter
  }

  set submitter(value: string | SubmitterHandler | null) {
    if (typeof value === "string") {
      this.#submitter = submitter[value] || value
    } else {
      this.#submitter = value
    }
  }
}

export const forms = new Config({
  mode: "on",
  formMode: "turbo",
  submitter: "disabled"
})
