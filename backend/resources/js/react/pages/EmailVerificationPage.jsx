import React from 'react'
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
  const canReturnToLogin = isVerified || isInvalid

  const title = isVerified
    ? "Your account is verified"
    : isInvalid
      ? "Verification link is invalid"
      : "Verify your account"

  const message = isVerified
    ? "Your email has been verified. You can now log in to your job seeker account."
    : isInvalid
      ? "This verification link is invalid or has already been used. Try logging in, or register again with a different email if needed."
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

          {canReturnToLogin && (
            <button type="button" className="register-btn email-verification-btn" onClick={onBackToLogin}>
              Back to Login
            </button>
          )}
        </div>
      </section>
    </main>
  )
}

export default EmailVerificationPage
