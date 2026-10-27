import React, { useRef } from "react"

export default function ProfileAttachmentInput({ id, label, file, savedName, savedUrl, className, onChange }) {
  const inputRef = useRef(null)
  return (
    <div className={`profile-attachment-control ${className || ""}`}>
      <input ref={inputRef} id={id} className="hidden-file-input" type="file"
        aria-label={label} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(event) => {
          const selected = event.target.files?.[0]
          event.target.value = ""
          if (selected) onChange(selected)
        }} />
      <div className="profile-attachment-status" aria-live="polite">
        {file ? <span>Selected: {file.name}</span>
          : savedUrl ? <span>Uploaded: {savedName}</span>
            : savedName ? <span>File unavailable: {savedName}. Please upload it again.</span>
              : <span>No file uploaded yet.</span>}
      </div>
      <div className="js-panel-actions">
        <button type="button" className="js-text-btn" onClick={() => inputRef.current.click()}>
          {file || savedUrl ? "Replace file" : "Choose file"}
        </button>
      </div>
    </div>
  )
}
