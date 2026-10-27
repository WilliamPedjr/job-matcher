import React, { useEffect, useRef } from "react"
import "../styles/ProfileCompletion.css"

export default function ProfileCompletionModal({ missing, checkFailed, onGoToProfile, onViewAnyway }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const previousFocus = document.activeElement
    dialogRef.current.showModal()
    return () => previousFocus?.focus()
  }, [])
  return (
    <dialog ref={dialogRef} className="modal-card profile-completion-modal" aria-labelledby="profile-completion-title"
      onCancel={(event) => { event.preventDefault(); onGoToProfile() }}>
      <h3 id="profile-completion-title">Complete your profile</h3>
      <p>{checkFailed ? "We couldn't verify your profile. You can update it or browse jobs without matching." : "Please complete all required profile information to see job matches and apply."}</p>
      {missing.length > 0 && <><p>Still needed:</p><ul>{missing.map((label) => <li key={label}>{label}</li>)}</ul></>}
      <p>You can view jobs anyway. Matching results will stay hidden until your profile is complete.</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" type="button" onClick={onViewAnyway}>View Jobs Anyway</button>
        <button className="btn primary" type="button" onClick={onGoToProfile}>Go to Profile</button>
      </div>
    </dialog>
  )
}
