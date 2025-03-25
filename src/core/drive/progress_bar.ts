import { unindent, getCspNonce } from "../../util"

export const ProgressBarID = "turbo-progress-bar"

export class ProgressBar {
  static readonly animationDuration = 300 /*ms*/

  static get defaultCSS(): string {
    return unindent`
      .turbo-progress-bar {
        position: fixed;
        display: block;
        top: 0;
        left: 0;
        height: 3px;
        background: #0076ff;
        z-index: 2147483647;
        transition:
          width ${ProgressBar.animationDuration}ms ease-out,
          opacity ${ProgressBar.animationDuration / 2}ms ${ProgressBar.animationDuration / 2}ms ease-in;
        transform: translate3d(0, 0, 0);
      }
    `
  }

  private hiding = false
  private value = 0
  private visible = false
  private readonly stylesheetElement: HTMLStyleElement
  private readonly progressElement: HTMLDivElement
  private trickleInterval?: number

  constructor() {
    this.stylesheetElement = this.createStylesheetElement()
    this.progressElement = this.createProgressElement()
    this.installStylesheetElement()
    this.setValue(0)
  }

  show(): void {
    if (!this.visible) {
      this.visible = true
      this.installProgressElement()
      this.startTrickling()
    }
  }

  hide(): void {
    if (this.visible && !this.hiding) {
      this.hiding = true
      this.fadeProgressElement(() => {
        this.uninstallProgressElement()
        this.stopTrickling()
        this.visible = false
        this.hiding = false
      })
    }
  }

  setValue(value: number): void {
    this.value = value
    this.refresh()
  }

  private installStylesheetElement(): void {
    document.head.insertBefore(this.stylesheetElement, document.head.firstChild)
  }

  private installProgressElement(): void {
    this.progressElement.style.width = "0"
    this.progressElement.style.opacity = "1"
    document.documentElement.insertBefore(this.progressElement, document.body)
    this.refresh()
  }

  private fadeProgressElement(callback: () => void): void {
    this.progressElement.style.opacity = "0"
    setTimeout(callback, ProgressBar.animationDuration * 1.5)
  }

  private uninstallProgressElement(): void {
    if (this.progressElement.parentNode) {
      document.documentElement.removeChild(this.progressElement)
    }
  }

  private startTrickling(): void {
    if (!this.trickleInterval) {
      this.trickleInterval = window.setInterval(this.trickle, ProgressBar.animationDuration)
    }
  }

  private stopTrickling(): void {
    if (this.trickleInterval) {
      window.clearInterval(this.trickleInterval)
      delete this.trickleInterval
    }
  }

  private trickle = (): void => {
    this.setValue(this.value + Math.random() / 100)
  }

  private refresh(): void {
    requestAnimationFrame(() => {
      this.progressElement.style.width = `${10 + this.value * 90}%`
    })
  }

  private createStylesheetElement(): HTMLStyleElement {
    const element = document.createElement("style")
    element.type = "text/css"
    element.textContent = ProgressBar.defaultCSS
    const cspNonce = getCspNonce()
    if (cspNonce) {
      element.nonce = cspNonce
    }
    return element
  }

  private createProgressElement(): HTMLDivElement {
    const element = document.createElement("div")
    element.className = "turbo-progress-bar"
    return element
  }
}
