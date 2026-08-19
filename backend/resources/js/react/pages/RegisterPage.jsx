import React from 'react'
import "../styles/RegisterPage.css"
import { useEffect, useState } from "react"
import lnuLogo from "../assets/Logo.png"
import eyeSolidIcon from "../assets/eye-solid-full.svg"
import eyeRegularIcon from "../assets/eye-regular-full.svg"

function RegisterPage({
  fullName = "",
  setFullName = () => {},
  email = "",
  setEmail = () => {},
  password = "",
  setPassword = () => {},
  confirmPassword = "",
  setConfirmPassword = () => {},
  registerError = "",
  registerNotice = "",
  onSubmit = () => {},
  onBack = () => {},
  onGoToLandingSection = () => {}
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const fullNameError = !fullName.trim()
  const emailError = !email.trim()
  const passwordError = !password.trim()
  const confirmPasswordError = !confirmPassword.trim()
  const passwordRequirementError =
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  const goToLandingSection = (id) => {
    onGoToLandingSection(id)
  }

  useEffect(() => {
    if (registerNotice) {
      setShowErrors(false)
    }
  }, [registerNotice])

  useEffect(() => {
    if (registerError) return
    if (!fullName.trim() && !email.trim() && !password.trim() && !confirmPassword.trim()) {
      setShowErrors(false)
    }
  }, [confirmPassword, email, fullName, password, registerError])

  return (
    <main className="register-shell">
      <header className="topbar register-topbar-shared register-topbar">
        <button type="button" className="brand" onClick={() => goToLandingSection("landing-hero")}>
          <img src={lnuLogo} alt="LNU-HiRe" />
          <span className="brand-copy">
            <span className="brand-name">LNU-HiRe</span>
            {/* <span className="brand-tagline">AI recruitment platform</span> */}
          </span>
        </button>

        <nav className="topnav register-topnav-shared register-nav" aria-label="Register page navigation" />
        <div className="register-topbar-cta">
          <button type="button" className="btn register-login-btn" onClick={onBack}>Login</button>
        </div>
      </header>

      <div className="register-layout">
        <div className="register-left">
          {/* <p className="register-eyebrow-modern">Smart Recruitment Portal</p> */}
          
          <button
            type="button"
            className="register-logo-button"
            onClick={() => goToLandingSection("landing-hero")}
            aria-label="Go to landing page"
          >
            <img src={lnuLogo} alt="LNU RecruitIQ" className="register-logo" />
          </button>
          {/* <h2 className="register-brand">LNU RecruitIQ</h2>
          <p className="register-school">Leyte Normal University</p>
          <p className="register-tagline">Hire smarter. Decide faster.</p> */}
          <h2 className="register-heading-modern">
            Welcome to <span>LNU-HiRe</span>
          </h2>
          <p className="register-tagline-modern">
            Create your account and start matching the right talent with the right role.
          </p>
        </div>

        <div className="register-right">
          <div className="register-card">
            <h1>Register Account</h1>
            <p className="register-subtitle">
              Fill in the details below to get started with LNU RecruitIQ.
            </p>

          <form
            className="register-form"
            onSubmit={(e) => {
              setShowErrors(true)
              onSubmit(e)
            }}
          >
            <label className="register-label">
              Full Name
            </label>
            <input
              className={`register-input ${showErrors && fullNameError ? "input-error" : ""}`}
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              required
            />

            <label className="register-label">Email Address</label>
            <input
              className={`register-input ${showErrors && emailError ? "input-error" : ""}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john.doe@gmail.com"
              required
            />

            <label className="register-label">Password</label>
            <div className="register-input-wrap">
              <input
                className={`register-input ${showErrors && (passwordError || passwordRequirementError) ? "input-error" : ""}`}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
              />
              <span
                className={`register-password-toggle ${showPassword ? "is-active" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setShowPassword((prev) => !prev)
                  }
                }}
              >
                <img src={showPassword ? eyeSolidIcon : eyeRegularIcon} alt="" />
              </span>
            </div>
            {(passwordRequirementError && (password || showErrors)) && (
              <p className="register-password-hint is-missing">
                Use uppercase, number, and special character.
              </p>
            )}

            <label className="register-label">Confirm Password</label>
            <div className="register-input-wrap">
              <input
                className={`register-input ${showErrors && confirmPasswordError ? "input-error" : ""}`}
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
              />
              <span
                className={`register-password-toggle ${showConfirmPassword ? "is-active" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setShowConfirmPassword((prev) => !prev)
                  }
                }}
              >
                <img src={showConfirmPassword ? eyeSolidIcon : eyeRegularIcon} alt="" />
              </span>
            </div>

            {registerNotice && <p className="register-notice">{registerNotice}</p>}
            {registerError && <p className="login-error-modern">{registerError}</p>}
            <button type="submit" className="register-btn">Create Account</button>
          </form>

            <p className="register-footer">
              Already have an account?{" "}
              <button type="button" className="register-link" onClick={onBack}>
                Login
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default RegisterPage
