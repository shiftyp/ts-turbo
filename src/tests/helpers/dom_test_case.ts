export class DOMTestCase {
  fixtureElement = document.createElement("main")
  
  async setup(): Promise<void> {
    this.fixtureElement.hidden = true
    document.body.insertAdjacentElement("afterbegin", this.fixtureElement)
  }

  async teardown(): Promise<void> {
    this.fixtureElement.innerHTML = ""
    this.fixtureElement.remove()
  }

  append(node: Node): void {
    this.fixtureElement.appendChild(node)
  }

  find(selector: string): Element | null {
    return this.fixtureElement.querySelector(selector)
  }

  get fixtureHTML(): string {
    return this.fixtureElement.innerHTML
  }

  set fixtureHTML(html: string) {
    this.fixtureElement.innerHTML = html
  }
}
