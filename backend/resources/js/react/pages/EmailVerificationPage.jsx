import React, { useEffect, useState } from 'react'
import { apiMessage } from '../utils/toasts'
import "../styles/EmailVerificationPage.css"
import lnuLogo from "../assets/Logo.png"

function EmailVerificationPage({
  email = "",
  status = "pending",
  onBackToLogin = () => {},
  onGoToLandingSection = () => {},
}) {
  const isVerified = status === "verified"
  const isInvalid = status === "invalid"
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [secondsRemaining, setSecondsRemaining] = useState(0)

  useEffect(() => {
    if (!cooldownUntil) return
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
      setSecondsRemaining(remaining)
      if (!remaining) setCooldownUntil(0)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil])

  const resendVerification = async (event) => {
    event.preventDefault()
    if (isResending || secondsRemaining > 0 || !email.trim()) return
    setIsResending(true)
    setResendMessage('')
    setResendError('')
    try {
      const response = await fetch('/api/job-seekers/email-verification/resend', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const payload = await response.json().catch(() => null)
      const retryAfter = Number(payload?.retryAfter || response.headers.get('Retry-After'))
      if ((response.ok || response.status === 429) && retryAfter > 0) {
        setSecondsRemaining(retryAfter)
        setCooldownUntil(Date.now() + retryAfter * 1000)
      }
      if (!response.ok) throw new Error(apiMessage(payload, 'Unable to resend verification email. Please try again later.'))
      setResendMessage(payload?.message || 'Verification email requested. Please check your inbox and Spam/Junk folder.')
    } catch (error) {
      setResendError(error.message || 'Unable to resend verification email.')
    } finally {
      setIsResending(false)
    }
  }

  const title = isVerified
    ? "Your account is verified"
    : isInvalid
      ? "Verification link is invalid"
      : "Verify your account"

  const message = isVerified
    ? "Your email has been verified. You can now log in to your job seeker account."
    : isInvalid
      ? "This verification link is invalid or has already been used. Try logging in if you already verified, or request another verification email below."
      : `We sent a verification email${email ? ` to ${email}` : ""}. Open the email and click the Verify Account button before logging in.`

  return (
    <main className="email-verification-shell">
      <header className="topbar register-topbar-shared email-verification-topbar">
        <button
          type="button"
          className="brand"
          onClick={() => onGoToLandingSection("landing-hero")}
        >
          <img src={lnuLogo} alt="LNU-HiRe" />
          <span className="brand-copy">
            <span className="brand-name">LNU-HiRe</span>
          </span>
        </button>
      </header>

      <section className="email-verification-layout">
        <div className="email-verification-card">
          <div className="email-verification-brand">
            <img src={lnuLogo} alt="" className="email-verification-logo" />
            <span>LNU-HiRe</span>
          </div>
          <div className={`email-verification-mark ${isVerified ? "is-verified" : isInvalid ? "is-invalid" : ""}`}>
            {isVerified ? "✓" : isInvalid ? "!" : "✉"}
          </div>
          <h1>{title}</h1>
          <p>{message}</p>

          {!isVerified && (
            <form className="email-verification-resend" onSubmit={resendVerification}>
              <button type="submit" className="register-btn email-verification-btn" disabled={isResending || secondsRemaining > 0 || !email.trim()}>
                {isResending ? 'Sending...' : secondsRemaining > 0 ? `Resend in ${secondsRemaining}s` : 'Resend verification email'}
              </button>
              {resendMessage && <p className="email-verification-feedback is-success" role="status">{resendMessage}</p>}
              {resendError && <p className="email-verification-feedback is-error" role="alert">{resendError}</p>}
            </form>
          )}
            <button type="button" className="register-btn email-verification-btn" onClick={onBackToLogin}>
              Back to Login
            </button>
        </div>
      </section>
    </main>
  )
}

export default EmailVerificationPage
