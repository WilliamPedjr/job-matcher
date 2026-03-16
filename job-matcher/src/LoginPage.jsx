import "./LoginPage.css"
import idCardIcon from "./assets/id-card-solid-full.svg"
import keyIcon from "./assets/key-solid-full.svg"
import facebookIcon from "./assets/facebook-f-brands-solid-full.svg"
import instagramIcon from "./assets/instagram-brands-solid-full.svg"
import appLogo from "./assets/647074929_927367613014494_5748890545922654578_n.png"

function LoginPage({
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  loginError,
  onSubmit,
  onRegister
}) {
  return (
    <main className="login-shell">
      <header className="topbar login-topbar-shared">
        <div className="brand">
          <img src={appLogo} alt="LNU RecruitIQ" />
        </div>
        <nav className="topnav login-topnav-shared">
          <button type="button" className="topnav-link">Services</button>
          <button type="button" className="topnav-link">About Us</button>
          <button type="button" className="topnav-link">Contact</button>
        </nav>
      </header>

      <section className="login-hero-modern">
        <div className="login-left-modern">
          <h1 className="login-heading-modern">JOB APPLICANT CLASSIFICATION AND DOCUMENT ANALYSIS SYSTEM</h1>
          <p className="login-tagline-modern">Analyze . Classify . Hire</p>

          <form className="login-form-modern" onSubmit={onSubmit}>
            <div className="login-input-wrap-modern">
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

            <div className="login-input-wrap-modern">
              <span className="login-input-icon-modern" aria-hidden="true">
                <img src={keyIcon} alt="" />
              </span>
              <input
                id="login-password"
                className="login-input-modern"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
                required
              />
            </div>

            <div className="login-options-modern">
              <label className="remember-option-modern">
                <input type="checkbox" />
                <span>Remember Me</span>
              </label>
              <button type="button" className="link-btn-modern">Forgot Password?</button>
            </div>

            {loginError && <p className="login-error-modern">{loginError}</p>}
            <div className="login-button-row-modern">
              <button type="submit" className="btn login-btn-modern">Sign in</button>
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
          <div className="login-visual">
            <img
              className="login-visual-image"
              src="https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=1400&q=80"
              alt="Office workspace"
            />
          </div>
        </div>
      </section>

      <section className="login-services-section">
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

      <section className="login-about-section">
        <h3>ABOUT US</h3>
        <p>
          JACDAS (Job Applicant Classification and Document Analysis System) is a web-based system
          developed to assist organizations in efficiently managing and evaluating job applications.
          The system analyzes applicant documents such as resumes and CVs to extract important
          information including skills, educational background, and work experience.
        </p>
        <p>
          By utilizing intelligent document analysis, JACDAS compares applicant qualifications with
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
          <div className="login-about-col">
            <h4>CONTACT US</h4>
            <p><strong>PHONE:</strong> +63 9123456789</p>
            <p><strong>EMAIL:</strong> jacdas@gmail.com</p>
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
