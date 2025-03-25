/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 Javan Makhmali
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

(function (prototype: HTMLFormElement['prototype']) {
  if (typeof (prototype as any).requestSubmit == "function") return

  (prototype as any).requestSubmit = function (submitter?: HTMLElement) {
    if (submitter) {
      validateSubmitter(submitter, this)
      submitter.click()
    } else {
      submitter = document.createElement("input") as HTMLInputElement
      (submitter as HTMLInputElement).type = "submit"
      submitter.hidden = true
      this.appendChild(submitter)
      submitter.click()
      this.removeChild(submitter)
    }
  }

  function validateSubmitter(submitter: HTMLElement, form: HTMLFormElement): void {
    if (!(submitter instanceof HTMLElement)) {
      raise(TypeError, "parameter 1 is not of type 'HTMLElement'", "submitter")
    } else if ((submitter as HTMLInputElement).type !== "submit") {
      raise(TypeError, "The specified element is not a submit button", "submitter")
    } else if ((submitter as HTMLInputElement).form !== form) {
      const error = new Error("The specified element is not owned by this form element")
      error.name = "NotFoundError"
      throw error
    }
  }

  function raise(errorConstructor: ErrorConstructor, message: string, name: string): void {
    throw new errorConstructor("Failed to execute 'requestSubmit' on 'HTMLFormElement': " + message)
  }
})(HTMLFormElement.prototype)
