import test from "node:test"
import assert from "node:assert/strict"
import { apiMessage, createToastStore, notificationType } from "../../resources/js/react/utils/toasts.js"
import { installFormValidationToasts } from "../../resources/js/react/utils/formValidationToasts.js"

function fixture() {
  let time = 0
  let nextHandle = 0
  const timers = new Map()
  const store = createToastStore({
    now: () => time,
    setTimer: (callback, duration) => {
      const handle = nextHandle++
      timers.set(handle, { callback, deadline: time + duration })
      return handle
    },
    clearTimer: (handle) => timers.delete(handle),
  })
  const advance = (duration) => {
    const end = time + duration
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.deadline <= end)
        .sort((a, b) => a[1].deadline - b[1].deadline)[0]
      if (!next) break
      time = next[1].deadline
      timers.delete(next[0])
      next[1].callback()
    }
    time = end
  }
  return { store, advance, timers }
}

test("server validation includes all field messages once, with useful fallbacks", () => {
  assert.equal(apiMessage({ message: "Invalid data (and 2 more errors)", errors: {
    startDate: ["Start date cannot be in the future."],
    endDate: ["End date must follow start date."],
    other: ["End date must follow start date.", null],
  } }), "Start date cannot be in the future.\nEnd date must follow start date.")
  assert.equal(apiMessage({ message: "Cannot delete: applicant has linked records." }), "Cannot delete: applicant has linked records.")
  assert.equal(apiMessage(null, "Please try again."), "Please try again.")
  assert.equal(apiMessage({ errors: {} }, "Please try again."), "Please try again.")
})

test("legacy fail messages and successful actions have consistent notification types", () => {
  assert.equal(notificationType("Please fill in all fields.", "fail"), "error")
  assert.equal(notificationType("Application rejected.", "success"), "success")
  assert.equal(notificationType("Saved."), "success")
  assert.equal(notificationType("Passwords do not match."), "error")
  assert.equal(notificationType("Please upload a PDS."), "error")
})

test("success dismisses automatically while errors remain longer", () => {
  const { store, advance } = fixture()
  store.notify("Saved.", "success")
  store.notify("Invalid date.", "error")
  advance(4499)
  assert.equal(store.getSnapshot().length, 2)
  advance(1)
  assert.deepEqual(store.getSnapshot().map((toast) => toast.type), ["error"])
  advance(2500)
  assert.equal(store.getSnapshot().length, 0)
})

test("repeated validation refreshes one toast and remains visible on later attempts", () => {
  const { store, advance } = fixture()
  const id = store.notify("Please fill in all fields.", "fail")
  advance(6000)
  assert.equal(store.notify("Please fill in all fields.", "error"), id)
  assert.equal(store.getSnapshot().length, 1)
  advance(1000)
  assert.equal(store.getSnapshot().length, 1)
  store.dismiss(id)
  assert.equal(store.getSnapshot().length, 0)
  assert.notEqual(store.notify("Please fill in all fields.", "error"), id)
  advance(7000)
  assert.equal(store.getSnapshot().length, 0)
})

test("hovering or focusing pauses expiry, including repeated pause events", () => {
  const { store, advance } = fixture()
  const id = store.notify("Saved.", "success")
  advance(1000)
  store.pause(id)
  store.pause(id)
  advance(20000)
  assert.equal(store.getSnapshot().length, 1)
  store.resume(id)
  advance(3499)
  assert.equal(store.getSnapshot().length, 1)
  advance(1)
  assert.equal(store.getSnapshot().length, 0)
})

test("notification stack stays bounded and dismissing clears pending timers", () => {
  const { store, timers } = fixture()
  for (let i = 1; i <= 6; i++) store.notify(`Error ${i}`, "error")
  assert.deepEqual(store.getSnapshot().map((toast) => toast.message), ["Error 3", "Error 4", "Error 5", "Error 6"])
  assert.equal(timers.size, 4)
  store.clear()
  assert.equal(store.getSnapshot().length, 0)
  assert.equal(timers.size, 0)
})

test("empty resets and progress labels do not create notification noise", () => {
  const { store } = fixture()
  for (const message of ["", null, "Saving...", "Uploading 2 files...", "Deleting…", "Loading..."]) {
    assert.equal(store.notify(message), null)
  }
  assert.equal(store.getSnapshot().length, 0)
})

function formFixture() {
  const handlers = new Map()
  const messages = []
  const document = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    removeEventListener: (name, handler) => { if (handlers.get(name) === handler) handlers.delete(name) },
  }
  const cleanup = installFormValidationToasts(document, (message, type) => messages.push({ message, type }))
  const field = (label, validationMessage) => {
    const classes = new Set()
    const attributes = new Map()
    return {
      labels: [{ textContent: label }], validationMessage, validity: { valid: false },
      classList: { add: (value) => classes.add(value), remove: (value) => classes.delete(value) },
      setAttribute: (key, value) => attributes.set(key, value), removeAttribute: (key) => attributes.delete(key),
      focus() { this.focused = true }, classes, attributes,
    }
  }
  const send = (name, target) => {
    const event = { target, prevented: false, preventDefault() { this.prevented = true } }
    handlers.get(name)?.(event)
    return event
  }
  return { messages, handlers, cleanup, field, send }
}

test("native invalid fields produce one toast, suppress browser bubbles and focus the first field", async () => {
  const { field, send, messages, cleanup } = formFixture()
  const email = field("Email", "Please enter a valid email address.")
  const password = field("Password", "Please fill out this field.")
  assert.equal(send("invalid", email).prevented, true)
  send("invalid", password)
  await Promise.resolve()
  assert.deepEqual(messages, [{ type: "error", message: "Email: Please enter a valid email address.\nPassword: Please fill out this field." }])
  assert.equal(email.focused, true)
  assert.equal(email.attributes.get("aria-invalid"), "true")
  assert.equal(password.classes.has("input-error"), true)
  cleanup()
})

test("native validation runs again on retry and clears highlights only after correction", async () => {
  const { field, send, messages, cleanup } = formFixture()
  const input = field("End date", "End date must be on or before today.")
  send("invalid", input)
  await Promise.resolve()
  send("input", input)
  assert.equal(input.classes.has("input-error"), true)
  send("invalid", input)
  await Promise.resolve()
  assert.equal(messages.length, 2)
  input.validity.valid = true
  send("change", input)
  assert.equal(input.classes.has("input-error"), false)
  assert.equal(input.attributes.has("aria-invalid"), false)
  cleanup()
})

test("validation cleanup cancels pending notices and removes handlers", async () => {
  const { field, send, messages, handlers, cleanup } = formFixture()
  send("invalid", field("Name", "Please fill out this field."))
  cleanup()
  await Promise.resolve()
  assert.equal(messages.length, 0)
  assert.equal(handlers.size, 0)
})
