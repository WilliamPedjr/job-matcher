import "./AppLayout.css"
import "./LoginPage.css"
import { useEffect, useState } from "react"
import idCardIcon from "./assets/id-card-solid-full.svg"
import keyIcon from "./assets/key-solid-full.svg"
import eyeSolidIcon from "./assets/eye-solid-full.svg"
import eyeRegularIcon from "./assets/eye-regular-full.svg"
import facebookIcon from "./assets/facebook-f-brands-solid-full.svg"
import instagramIcon from "./assets/instagram-brands-solid-full.svg"
import loginImage from "./assets/Logo.png"

function LoginPage({
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword, 
  loginError,
  captchaBypassEnabled,
  setCaptchaBypassEnabled,
  onSubmit,
  onRegister
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [recaptchaStatus, setRecaptchaStatus] = useState("loading")
  const [showErrors, setShowErrors] = useState(false)
  const RECAPTCHA_SITE_KEY = "6LdOdpMsAAAAAPP2S_pBfwGmkeyGDO_3_h8BatH_"
  const recaptchaContainerId = "login-recaptcha"
  const emailError = !loginEmail.trim()
  const passwordError = !loginPassword.trim()
  const handleScrollTo = (id) => {
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  useEffect(() => {
    let attempts = 0
    let isMounted = true
    const timer = setInterval(() => {
      const grecaptcha = window.grecaptcha
      const container = document.getElementById(recaptchaContainerId)
      if (!container || !grecaptcha) {
        attempts += 1
        if (attempts > 60) {
          clearInterval(timer)
          if (isMounted) {
            setRecaptchaStatus("failed")
          }
        }
        return
      }
      if (window.__loginRecaptchaWidgetId != null) {
        clearInterval(timer)
        if (isMounted) {
          setRecaptchaStatus("ready")
        }
        return
      }
      try {
        const widgetId = grecaptcha.render(container, {
          sitekey: RECAPTCHA_SITE_KEY
        })
        window.__loginRecaptchaWidgetId = widgetId
        if (isMounted) {
          setRecaptchaStatus("ready")
        }
      } catch (err) {
        if (isMounted) {
          setRecaptchaStatus("failed")
        }
      }
      clearInterval(timer)
    }, 200)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

  return (
    <main className="login-shell">
      <header className="topbar login-topbar-shared">
        <nav className="topnav login-topnav-shared">
          <button type="button" className="topnav-link" onClick={() => handleScrollTo("login-services")}>Services</button>
          <button type="button" className="topnav-link" onClick={() => handleScrollTo("login-about")}>About Us</button>
          <button type="button" className="topnav-link" onClick={() => handleScrollTo("login-contact")}>Contact</button>
        </nav>
        <div className="login-topbar-cta">
          <button type="button" className="btn login-signin-btn" onClick={onRegister}>Sign In</button>
        </div>
      </header>

      <section className="login-hero-modern" id="login-hero">
        <div className="login-left-modern">
          {/* <p className="login-eyebrow-modern">Smart Recruitment Portal</p> */}
          <h1 className="login-heading-modern">
            Welcome to <span>LNU-HiRe</span>
          </h1>
          <p className="login-tagline-modern">
            Find the best-fit talent faster with intelligent applicant matching.
          </p>

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
                placeholder="Username"
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
                <input type="checkbox" />
                <span>Remember Me</span>
              </label>
              <button type="button" className="link-btn-modern">Forgot Password?</button>
            </div>

            <div className="login-recaptcha-wrap">
              <div id={recaptchaContainerId} />
            </div>

            {recaptchaStatus === "failed" && (
              <div className="login-captcha-bypass">
                <p>reCAPTCHA did not load. You can bypass it to continue.</p>
                <label className="login-bypass-option">
                  <input
                    type="checkbox"
                    checked={captchaBypassEnabled}
                    onChange={(e) => setCaptchaBypassEnabled(e.target.checked)}
                  />
                  <span>Bypass reCAPTCHA for this login</span>
                </label>
              </div>
            )}

            {loginError && <p className="login-error-modern">{loginError}</p>}
            <div className="login-button-row-modern">
              <button type="submit" className="btn login-btn-modern">Log in</button>
            </div>
          </form>

          <p className="login-register-modern">
            Don't have Account?{" "}
            <button type="button" className="link-btn-modern" onClick={onRegister}>
              Register
            </button>
          </p>
        </div>

        <div className="login-right-modern">
          <div className="login-brand-card">
            <img src={loginImage} alt="LNU RecruitIQ" className="login-brand-logo" />
            {/* <h2 className="login-brand-title">LNU RecruitIQ</h2>
            <p className="login-brand-school">Leyte Normal University</p> */}
            {/* <p className="login-brand-tagline">Connecting Talent · Empowering Futures</p> */}
          </div>
        </div>
      </section>

      <section className="login-services-section" id="login-services">
        <h3>Services</h3>

        <div className="login-service-item">
          <h4>Resume &amp; Document Analysis</h4>
          <p>Automatically scans and analyzes applicant resumes and documents to extract key information such as skills, education, and work experience.</p>
        </div>

        <div className="login-service-item">
          <h4>Applicant Classification</h4>
          <p>Organizes and categorizes job applicants based on their qualifications and the requirements of the job position.</p>
        </div>

        <div className="login-service-item">
          <h4>Job Requirement Matching</h4>
          <p>Compares applicant information with job descriptions to determine how well each candidate fits the role.</p>
        </div>

        <div className="login-service-item">
          <h4>Applicant Scoring &amp; Ranking</h4>
          <p>Generates a matching score for each applicant to help employers quickly identify the most qualified candidates.</p>
        </div>

        <div className="login-service-item">
          <h4>Applicant Data Management</h4>
          <p>Securely stores and organizes applicant documents and profiles for easy access and efficient recruitment management.</p>
        </div>
      </section>

      <section className="login-about-section" id="login-about">
        <h3>ABOUT US</h3>
        <p>
          LNU RecruitIQ is a web-based system
          developed to assist organizations in efficiently managing and evaluating job applications.
          The system analyzes applicant documents such as resumes and CVs to extract important
          information including skills, educational background, and work experience.
        </p>
        <p>
          By utilizing intelligent document analysis, LNU RecruitIQ compares applicant qualifications with
          predefined job requirements to determine the most suitable candidates for a position.
          The system also organizes and ranks applicants based on their level of compatibility with
          the job criteria.
        </p>
        <p>
          Our goal is to simplify the recruitment process by reducing manual screening, improving
          evaluation accuracy, and helping employers especially small organizations make faster and
          more informed hiring decisions.
        </p>

        <div className="login-about-footer">
          <div className="login-about-col" id="login-contact">
            <h4>CONTACT US</h4>
            <p><strong>PHONE:</strong> +639123456789</p>
            <p><strong>EMAIL:</strong> LNURecruitIQ@gmail.com</p>
          </div>
          <div className="login-about-col">
            <h4>FOLLOW US</h4>
            <p className="login-social-row">
              <img className="login-social-icon" src={facebookIcon} alt="Facebook" />
              <img className="login-social-icon" src={instagramIcon} alt="Instagram" />
            </p>
          </div>
        </div>

        <p className="login-copyright">copyright served @ 2026</p>
      </section>
    </main>
  )
}

export default LoginPage
