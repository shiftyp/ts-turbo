export class TurboFrameMissingError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = "TurboFrameMissingError"
    Object.setPrototypeOf(this, TurboFrameMissingError.prototype)
  }
}
