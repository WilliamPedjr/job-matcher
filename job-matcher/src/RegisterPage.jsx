import "./RegisterPage.css"
import { useEffect, useState } from "react"
import lnuLogo from "./assets/Logo.png"
import eyeSolidIcon from "./assets/eye-solid-full.svg"
import eyeRegularIcon from "./assets/eye-regular-full.svg"

function RegisterPage({
  fullName = "",
  setFullName = () => {},
  username = "",
  setUsername = () => {},
  phone = "",
  setPhone = () => {},
  email = "",
  setEmail = () => {},
  password = "",
  setPassword = () => {},
  confirmPassword = "",
  setConfirmPassword = () => {},
  registerError = "",
  registerNotice = "",
  onSubmit = () => {},
  onBack = () => {}
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const fullNameError = !fullName.trim()
  const usernameError = !username.trim()
  const emailError = !email.trim()
  const phoneError = !phone.trim()
  const passwordError = !password.trim()
  const confirmPasswordError = !confirmPassword.trim()

  useEffect(() => {
    if (registerNotice) {
      setShowErrors(false)
    }
  }, [registerNotice])

  return (
    <main className="register-shell">
      <header className="topbar register-topbar-shared register-topbar">
        <nav className="topnav register-topnav-shared register-nav">
          <button type="button" className="topnav-link register-nav-link">Services</button>
          <button type="button" className="topnav-link register-nav-link">About Us</button>
          <button type="button" className="topnav-link register-nav-link">Contact</button>
        </nav>
        <div className="register-topbar-cta">
          <button type="button" className="btn register-login-btn" onClick={onBack}>Login</button>
        </div>
      </header>

      <div className="register-layout">
        <div className="register-left">
          <img src={lnuLogo} alt="LNU RecruitIQ" className="register-logo" />
          <h2 className="register-brand">LNU RecruitIQ</h2>
          <p className="register-school">Leyte Normal University</p>
          <p className="register-tagline">Hire smarter. Decide faster.</p>
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
              Full Name <span>(Name Middle Initial Family Name)</span>
            </label>
            <input
              className={`register-input ${showErrors && fullNameError ? "input-error" : ""}`}
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              required
            />

            <label className="register-label">Username</label>
            <input
              className={`register-input ${showErrors && usernameError ? "input-error" : ""}`}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="johndoe"
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

            <label className="register-label">Phone</label>
            <input
              className={`register-input ${showErrors && phoneError ? "input-error" : ""}`}
              type="tel"
              inputMode="numeric"
              value={`+63${phone}`}
              onChange={(e) => {
                const digitsOnly = String(e.target.value || "").replace(/\D/g, "")
                let local = digitsOnly
                if (local.startsWith("63")) {
                  local = local.slice(2)
                }
                if (local.startsWith("0")) {
                  local = local.slice(1)
                }
                setPhone(local.slice(0, 10))
              }}
              placeholder="+63xxxxxxxxxx"
              required
            />

            <label className="register-label">Password</label>
            <div className="register-input-wrap">
              <input
                className={`register-input ${showErrors && passwordError ? "input-error" : ""}`}
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
