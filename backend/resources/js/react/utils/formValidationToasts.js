import { notify } from "./toasts.js"

// Group the browser's field errors into one toast for each submit attempt.
export function installFormValidationToasts(document, publish = notify) {
  let pending = []
  let scheduled = false
  const marked = new WeakSet()
  const invalid = (event) => {
    event.preventDefault()
    const input = event.target
    marked.add(input)
    input.setAttribute("aria-invalid", "true")
    input.classList.add("input-error")
    const label = input.labels?.[0]?.textContent?.trim()
      || input.closest(".field-group")?.querySelector("label")?.textContent?.trim()
      || input.placeholder || input.name || "This field"
    pending.push({ input, message: `${label}: ${input.validationMessage}` })
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      if (pending.length) {
        publish([...new Set(pending.map((entry) => entry.message))].join("\n"), "error")
        pending.find(({ input }) => input.isConnected !== false)?.input.focus()
      }
      pending = []
      scheduled = false
    })
  }
  const clearInvalid = (event) => {
    const input = event.target
    if (marked.has(input) && input.validity?.valid) {
      input.removeAttribute("aria-invalid")
      input.classList.remove("input-error")
      marked.delete(input)
    }
  }
  document.addEventListener("invalid", invalid, true)
  document.addEventListener("input", clearInvalid, true)
  document.addEventListener("change", clearInvalid, true)
  return () => {
    pending = []
    document.removeEventListener("invalid", invalid, true)
    document.removeEventListener("input", clearInvalid, true)
    document.removeEventListener("change", clearInvalid, true)
  }
}
