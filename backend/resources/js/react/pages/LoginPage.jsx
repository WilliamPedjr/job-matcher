import React from 'react'
import "../layouts/AppLayout.css"
import "../styles/LoginPage.css"
import { useEffect, useState } from "react"
import idCardIcon from "../assets/id-card-solid-full.svg"
import keyIcon from "../assets/key-solid-full.svg"
import eyeSolidIcon from "../assets/eye-solid-full.svg"
import eyeRegularIcon from "../assets/eye-regular-full.svg"
import facebookIcon from "../assets/facebook-f-brands-solid-full.svg"
import instagramIcon from "../assets/instagram-brands-solid-full.svg"
import loginImage from "../assets/Logo.png"

function LoginPage({
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword, 
  loginError,
  rememberMe,
  setRememberMe,
  loginMode,
  setLoginMode,
  onSubmit,
  onRegister,
  onGoToLandingSection = () => {}
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const isJobSeekerMode = loginMode === "jobseeker"
  const emailError = !loginEmail.trim()
  const passwordError = !loginPassword.trim()

  useEffect(() => {
    if (loginError) return
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setShowErrors(false)
    }
  }, [loginEmail, loginPassword, loginError])

  return (
    <main className={`login-shell ${isJobSeekerMode ? "jobseeker-login-shell" : "staff-login-shell"}`}>
      <header className="topbar login-topbar-shared login-topbar">
        <button type="button" className="brand" onClick={() => onGoToLandingSection("landing-hero")}>
          <img src={loginImage} alt="LNU-HiRe" />
          <span className="brand-copy">
            <span className="brand-name">LNU-HiRe</span>
            {/* <span className="brand-tagline">AI recruitment platform</span> */}
          </span>
        </button>

        <nav className="topnav login-topnav-shared login-nav" aria-label="Login page navigation" />
        <div className="login-topbar-cta">
          {isJobSeekerMode && (
            <button type="button" className="btn login-signin-btn" onClick={onRegister}>Job Seeker Register</button>
          )}
        </div>
      </header>

      <section className={`login-hero-modern ${isJobSeekerMode ? "jobseeker-login-hero" : "staff-login-hero"}`} id="login-hero">
        <div className="login-left-modern">
          {!isJobSeekerMode && (
            <img src={loginImage} alt="LNU-HiRe" className="staff-login-logo" />
          )}
          <h1 className="login-heading-modern">
            Welcome to <span>LNU-HiRe</span>
          </h1>
          <p className="login-tagline-modern">
            Sign in to track applications or register a new profile.
          </p>

          <div className="login-portal-heading">
            <span>{isJobSeekerMode ? "Job Seeker Portal" : "Personnel/Admin Portal"}</span>
          </div>

          <form
            className="login-form-modern"
            onSubmit={(e) => {
              setShowErrors(true)
              onSubmit(e)
            }}
          >
            <div className={`login-input-wrap-modern ${showErrors && emailError ? "input-error" : ""}`}>
              <span className="login-input-icon-modern" aria-hidden="true">
                <img src={idCardIcon} alt="" />
              </span>
              <input
                id="login-username"
                className="login-input-modern"
                type="text"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder={isJobSeekerMode ? "Email or Username" : "Email, Username, or ID Number"}
                required
              />
            </div>

            <div className={`login-input-wrap-modern login-password-wrap ${showErrors && passwordError ? "input-error" : ""}`}>
              <span className="login-input-icon-modern" aria-hidden="true">
                <img src={keyIcon} alt="" />
              </span>
              <input
                id="login-password"
                className="login-input-modern"
                type={showPassword ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
                required
              />
              <span
                className={`login-password-toggle ${showPassword ? "is-active" : ""}`}
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

            <div className="login-options-modern">
              <label className="remember-option-modern">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember Me</span>
              </label>
              {isJobSeekerMode && (
                <button
                  type="button"
                  className="link-btn-modern"
                  onClick={() => window.location.assign("/forgot-password")}
                >
                  Forgot Password?
                </button>
              )}
            </div>

            {loginError && <p className="login-error-modern">{loginError}</p>}
            <div className="login-button-row-modern">
              <button type="submit" className="btn login-btn-modern">
                Log In
                {/* Log In as {isJobSeekerMode ? "Job Seeker" : "Employer/Admin"} */}
              </button>
            </div>
          </form>

          {isJobSeekerMode && (
            <p className="login-register-modern">
              Need a job seeker account?{" "}
              <button type="button" className="link-btn-modern" onClick={onRegister}>
                Register
              </button>
            </p>
          )}
          {isJobSeekerMode && (
            <p className="login-admin-switch">
              Are you an HR Administrator or Staff?{" "}
              <button type="button" onClick={() => setLoginMode("staff")}>
                Admin Sign In
              </button>
            </p>
          )}
        </div>

        {isJobSeekerMode && (
          <div className="login-right-modern">
            <div className="login-brand-card">
              <img src={loginImage} alt="LNU RecruitIQ" className="login-brand-logo" />
            </div>
          </div>
        )}
      </section>

      
    </main>
  )
}

export default LoginPage
