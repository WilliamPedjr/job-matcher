export function apiMessage(payload, fallback = "Something went wrong. Please try again.") {
  const messages = payload?.errors && typeof payload.errors === "object"
    ? Object.values(payload.errors).flat().filter((message) => typeof message === "string" && message.trim())
    : []
  return [...new Set(messages)].join("\n") || payload?.message || fallback
}

export function notificationType(message, type = "auto") {
  if (["error", "fail", "danger"].includes(type)) return "error"
  if (["success", "info", "warning"].includes(type)) return type
  if (/\b(failed|failure|error|invalid|cannot|can't|unable|wrong|missing|required|must|not match|do not|does not|not found|not allowed)\b/i.test(message)) return "error"
  if (/\b(saved|created|updated|deleted|removed|replaced|uploaded|restored|exported|submitted|registered|verified|successful|successfully|hidden|sent)\b/i.test(message)) return "success"
  return "error"
}

export function createToastStore({ setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now } = {}) {
  let toasts = []
  let nextId = 0
  const listeners = new Set()
  const timers = new Map()
  const lifetimes = { success: 4500, error: 7000, info: 4500, warning: 6000 }
  const emit = () => listeners.forEach((listener) => listener())
  const stopTimer = (id) => {
    const timer = timers.get(id)
    if (timer?.handle !== undefined) clearTimer(timer.handle)
    timers.delete(id)
    return timer
  }
  const dismiss = (id) => {
    stopTimer(id)
    toasts = toasts.filter((toast) => toast.id !== id)
    emit()
  }
  const schedule = (id, duration) => {
    stopTimer(id)
    timers.set(id, { handle: setTimer(() => dismiss(id), duration), deadline: now() + duration, remaining: duration })
  }
  const notify = (input, requestedType = "auto") => {
    const message = String(typeof input === "object" && input !== null ? input.message || "" : input || "").trim()
    if (!message || /^(saving|uploading|loading|removing|deleting|submitting|sending|processing|exporting)\b.*(?:\.{3}|…)$/i.test(message)) return null
    const type = notificationType(message, input?.type || requestedType)
    const existing = toasts.find((toast) => toast.message === message && toast.type === type)
    const id = existing?.id ?? ++nextId
    toasts = [...toasts.filter((toast) => toast.id !== id), { id, type, message }]
    while (toasts.length > 4) stopTimer(toasts.shift().id)
    schedule(id, lifetimes[type])
    emit()
    return id
  }
  return {
    notify, dismiss,
    getSnapshot: () => toasts,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    pause: (id) => {
      const timer = stopTimer(id)
      if (timer) timers.set(id, { remaining: timer.handle === undefined ? timer.remaining : Math.max(0, timer.deadline - now()) })
    },
    resume: (id) => {
      const timer = timers.get(id)
      if (timer && timer.handle === undefined) schedule(id, timer.remaining)
    },
    clear: () => {
      for (const id of timers.keys()) stopTimer(id)
      toasts = []
      emit()
    },
  }
}

export const toastStore = createToastStore()
export const notify = toastStore.notify
