function LoginPage({
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  loginError,
  onSubmit
}) {
  return (
    <main className="login-page">
      <div className="login-band top"></div>
      <div className="login-band bottom"></div>

      <section className="login-card">
        <div className="login-brand-wrap">
          {/* <div className="login-logo-mark">J</div> */}
          <h1 className="login-brand">JACDAS</h1>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <div className="login-input-wrap">
            <span className="login-input-icon" aria-hidden="true">ID</span>
            <input
              id="login-email"
              className="input login-input"
              type="text"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="ID"
              required
            />
          </div>

          <div className="login-input-wrap">
            <span className="login-input-icon" aria-hidden="true">🔑</span>
            <input
              id="login-password"
              className="input login-input"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              required
            />
          </div>

          <div className="login-options">
            <label className="remember-option">
              <input type="checkbox" />
              <span>Remember Me</span>
            </label>
            <button type="button" className="link-btn">Forgot Password?</button>
          </div>

          {loginError && <p className="login-error">{loginError}</p>}
          <div className="login-container">

          <button type="submit" className="btn login-btn">Sign in</button>
          </div>
        </form>

        <p className="login-register">
          Don't have Account? <button type="button" className="link-btn">Register</button>
        </p>
      </section>
    </main>
  )
}

export default LoginPage
