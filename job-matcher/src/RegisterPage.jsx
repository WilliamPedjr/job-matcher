import "./RegisterPage.css"
import lnuLogo from "./assets/647074929_927367613014494_5748890545922654578_n.png"

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
  onSubmit = () => {},
  onBack = () => {}
}) {
  return (
    <main className="register-shell">
      <header className="topbar login-topbar-shared register-topbar">
        <div className="brand">
          <img src={lnuLogo} alt="LNU RecruitIQ" />
        </div>
        <nav className="topnav login-topnav-shared register-nav">
          <button type="button" className="topnav-link register-nav-link">Services</button>
          <button type="button" className="topnav-link register-nav-link">About Us</button>
          <button type="button" className="topnav-link register-nav-link">Contact</button>
        </nav>
      </header>

      <div className="register-layout">
        <div className="register-left">
          <img src={lnuLogo} alt="LNU RecruitIQ" className="register-logo" />
          <h2 className="register-brand">LNU RecruitIQ</h2>
          <p className="register-school">Leyte Normal University</p>
          <p className="register-tagline">Connecting Talent · Empowering Futures</p>
        </div>

        <div className="register-right">
          <div className="register-card">
            <h1>Register Account</h1>
            <p className="register-subtitle">
              Fill in the details below to get started with LNU RecruitIQ.
            </p>

          <form className="register-form" onSubmit={onSubmit}>
            <label className="register-label">
              Full Name <span>(Name Middle Initial Family Name)</span>
            </label>
            <input
              className="register-input"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              required
            />

            <label className="register-label">Username</label>
            <input
              className="register-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="johndoe"
              required
            />

            <label className="register-label">Email Address</label>
            <input
              className="register-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john.doe@gmail.com"
              required
            />

            <label className="register-label">Phone</label>
            <input
              className="register-input"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 09123456789"
              required
            />

            <label className="register-label">Password</label>
            <input
              className="register-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
            />

            <label className="register-label">Confirm Password</label>
            <input
              className="register-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
            />

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
