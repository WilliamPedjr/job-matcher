import React, { useEffect, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { toastStore } from "../utils/toasts"
import { installFormValidationToasts } from "../utils/formValidationToasts"
import "../styles/Toaster.css"

const icons = { success: "✓", error: "!", info: "i", warning: "!" }
const labels = { success: "Success", error: "Error", info: "Information", warning: "Warning" }

export default function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getSnapshot)

  useEffect(() => installFormValidationToasts(document), [])

  return createPortal(
    <section className="app-toaster" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`app-toast app-toast-${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
          aria-atomic="true"
          onMouseEnter={() => toastStore.pause(toast.id)}
          onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) toastStore.resume(toast.id) }}
          onFocus={() => toastStore.pause(toast.id)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(":hover")) toastStore.resume(toast.id) }}
        >
          <span className="app-toast-icon" aria-hidden="true">{icons[toast.type]}</span>
          <div className="app-toast-content">
            <strong>{labels[toast.type]}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" className="app-toast-close" aria-label="Dismiss notification" onClick={() => toastStore.dismiss(toast.id)}>×</button>
        </div>
      ))}
    </section>, document.body
  )
}
