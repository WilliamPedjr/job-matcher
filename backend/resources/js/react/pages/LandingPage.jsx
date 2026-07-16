import React, { useEffect, useMemo, useState } from "react"
import "../styles/LandingPage.css"
import facebookIcon from "../assets/facebook-f-brands-solid-full.svg"
import instagramIcon from "../assets/instagram-brands-solid-full.svg"
import logoMark from "../assets/Logo.png"

function parseSkills(skillsData) {
  if (!skillsData) return []
  if (Array.isArray(skillsData)) {
    return skillsData.map((skill) => String(skill).trim()).filter(Boolean)
  }

  if (typeof skillsData === "string") {
    const normalized = skillsData.trim()
    if (!normalized) return []

    if (normalized.startsWith("[") && normalized.endsWith("]")) {
      try {
        const parsed = JSON.parse(normalized)
        if (Array.isArray(parsed)) {
          return parsed.map((skill) => String(skill).trim()).filter(Boolean)
        }
      } catch {
        // Fall back to delimiter parsing.
      }
    }

    return normalized
      .split(/[,;\n|]+/)
      .map((skill) => skill.trim())
      .filter(Boolean)
  }

  return []
}

function LandingPage({ onLoginClick, onRegisterClick, scrollToSectionId = "" }) {
  const [featuredJobs, setFeaturedJobs] = useState([])
  const [summary, setSummary] = useState(null)
  const [loadingLanding, setLoadingLanding] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fetchLandingSummary = async () => {
      try {
        const response = await fetch("/api/landing-summary")
        if (!response.ok) {
          throw new Error("Failed to load landing summary")
        }
        const data = await response.json()
        if (!isMounted) return
        setSummary(data?.summary || null)
        setFeaturedJobs(Array.isArray(data?.featured_jobs) ? data.featured_jobs : [])
      } catch {
        if (isMounted) {
          setSummary(null)
          setFeaturedJobs([])
        }
      } finally {
        if (isMounted) {
          setLoadingLanding(false)
        }
      }
    }

    fetchLandingSummary()

    return () => {
      isMounted = false
    }
  }, [])

  const stats = useMemo(() => {
    const activeJobs = Number(summary?.active_jobs || 0)
    const totalJobSeekers = Number(summary?.total_job_seekers || 0)
    const totalApplications = Number(summary?.total_applications || 0)
    const remoteFriendly = Number(summary?.remote_or_hybrid_jobs || 0)
    const averageMatchScore = Number(summary?.average_match_score || 0)

    return [
      { value: `${activeJobs}`, label: "Active openings" },
      { value: `${totalApplications}`, label: "Applications tracked" },
      { value: `${totalJobSeekers}`, label: "Job seeker profiles" },
      { value: `${Math.round(averageMatchScore)}%`, label: "Average match score" },
    ]
  }, [summary])

  const highlights = [
    "AI resume parsing",
    "Score-based ranking",
    "Applicant dashboards",
    "Secure document storage",
  ]

  const handleScrollTo = (id) => {
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  useEffect(() => {
    if (!scrollToSectionId) return

    const frame = window.requestAnimationFrame(() => {
      handleScrollTo(scrollToSectionId)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [scrollToSectionId])

  return (
    <main className="landing-shell">
      <div className="landing-ambient landing-ambient-left" aria-hidden="true" />
      <div className="landing-ambient landing-ambient-right" aria-hidden="true" />

      <header className="landing-topbar">
        <button type="button" className="landing-brand" onClick={() => handleScrollTo("landing-hero")}>
          <img src={logoMark} alt="LNU-HiRe" className="landing-brand-logo" />
          <span className="landing-brand-copy">
            <span className="landing-brand-name">LNU-HiRe</span>
            <span className="landing-brand-tagline">AI recruitment platform</span>
          </span>
        </button>

        <nav className="landing-nav" aria-label="Landing page">
          <button type="button" className="landing-nav-link" onClick={() => handleScrollTo("landing-features")}>
            Features
          </button>
          <button type="button" className="landing-nav-link" onClick={() => handleScrollTo("landing-about")}>
            About
          </button>
          <button type="button" className="landing-nav-link" onClick={() => handleScrollTo("landing-how-it-works")}>
            How It Works
          </button>
          <button type="button" className="landing-nav-link" onClick={() => handleScrollTo("landing-jobs")}>
            Jobs
          </button>
          <button type="button" className="landing-nav-link" onClick={() => handleScrollTo("landing-footer")}>
            Contact
          </button>
        </nav>

        <div className="landing-actions">
          <button type="button" className="btn btn-secondary landing-ghost-btn" onClick={onLoginClick}>
            Log In
          </button>
          <button type="button" className="btn btn-primary landing-accent-btn" onClick={onRegisterClick}>
            Get Started
          </button>
        </div>
      </header>

      <section className="landing-hero" id="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-hero-brand">
            <img src={logoMark} alt="LNU-HiRe" className="landing-hero-brand-logo" />
            <div className="landing-hero-brand-text">
              <p className="landing-hero-brand-kicker">Official platform</p>
              <h1 className="landing-hero-brand-title">LNU-HiRe</h1>
            </div>
          </div>

          <div className="landing-hero-strip" aria-hidden="true">
            <span>Recruit faster</span>
            <span>Rank smarter</span>
            <span>Hire with clarity</span>
          </div>

          <div className="landing-kicker">
            <span className="landing-kicker-dot" />
            Smart hiring for modern teams
          </div>

          <h1 className="landing-title">
            Find the right people faster with
            <span className="landing-title-highlight"> AI-assisted recruitment</span>
          </h1>

          <p className="landing-subtitle">
            LNU-HiRe helps you screen applicants, compare requirements, and surface the strongest matches in
            one clean dashboard, so your team spends less time sorting and more time hiring.
          </p>

          <div className="landing-hero-note">
            Built for simple, practical recruitment workflows that feel clean on desktop and mobile.
          </div>

          <div className="landing-hero-ctas">
            <button type="button" className="btn btn-primary btn-lg landing-primary-cta" onClick={onRegisterClick}>
              Start Free
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-lg landing-secondary-cta"
              onClick={() => handleScrollTo("landing-how-it-works")}
            >
              See the flow
            </button>
          </div>

          <div className="landing-highlights" aria-label="Platform highlights">
            {highlights.map((item) => (
              <span key={item} className="landing-highlight-pill">
                {item}
              </span>
            ))}
          </div>

          <div className="landing-stats" aria-label="Platform metrics">
            {stats.map((stat) => (
              <article key={stat.label} className="landing-stat-card">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-float-card">
            <span className="landing-float-label">Applicants reviewed</span>
            <strong>{Number(summary?.reviewed_applications || 0)}</strong>
            <p>Applications with analyzed match scores.</p>
          </div>

          <div className="landing-dashboard-card landing-dashboard-card-main">
            <div className="landing-dashboard-top">
              <div>
                <p className="landing-dashboard-label">Recruitment Overview</p>
                <h2>Live matching pipeline</h2>
              </div>
              <span className="landing-badge">Live</span>
            </div>

            <div className="landing-dashboard-metric">
              <span>Average match score</span>
              <strong>{Math.round(Number(summary?.average_match_score || 0))}%</strong>
            </div>

            <div className="landing-dashboard-bars">
              <div className="landing-bar-row">
                <div className="landing-bar-meta">
                  <span>Active openings</span>
                  <strong>{Number(summary?.total_jobs || 0) ? Math.round((Number(summary?.active_jobs || 0) / Number(summary?.total_jobs || 1)) * 100) : 0}%</strong>
                </div>
                <div className="landing-bar">
                  <span style={{ width: `${Number(summary?.total_jobs || 0) ? Math.round((Number(summary?.active_jobs || 0) / Number(summary?.total_jobs || 1)) * 100) : 0}%` }} />
                </div>
              </div>
              <div className="landing-bar-row">
                <div className="landing-bar-meta">
                  <span>Reviewed applications</span>
                  <strong>{Number(summary?.total_applications || 0) ? Math.round((Number(summary?.reviewed_applications || 0) / Number(summary?.total_applications || 1)) * 100) : 0}%</strong>
                </div>
                <div className="landing-bar">
                  <span style={{ width: `${Number(summary?.total_applications || 0) ? Math.round((Number(summary?.reviewed_applications || 0) / Number(summary?.total_applications || 1)) * 100) : 0}%` }} />
                </div>
              </div>
              <div className="landing-bar-row">
                <div className="landing-bar-meta">
                  <span>Remote or hybrid roles</span>
                  <strong>{Number(summary?.active_jobs || 0) ? Math.round((Number(summary?.remote_or_hybrid_jobs || 0) / Number(summary?.active_jobs || 1)) * 100) : 0}%</strong>
                </div>
                <div className="landing-bar">
                  <span style={{ width: `${Number(summary?.active_jobs || 0) ? Math.round((Number(summary?.remote_or_hybrid_jobs || 0) / Number(summary?.active_jobs || 1)) * 100) : 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="landing-dashboard-card landing-dashboard-card-side">
            <p className="landing-dashboard-label">Today</p>
            <h3>{featuredJobs.length || 0} featured openings</h3>
            <div className="landing-mini-list">
              {(featuredJobs.slice(0, 3).length ? featuredJobs.slice(0, 3) : [
                { title: "Load available roles to preview", location: "Live listings will appear here" }
              ]).map((job) => (
                <div key={job.id || job.title} className="landing-mini-item">
                  <strong>{job.title || "Untitled role"}</strong>
                  <span>{job.location || "Location available on listing"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-trustbar" aria-label="Key capabilities">
        <div className="landing-trustbar-inner">
          <span>Resume parsing</span>
          <span>Skill matching</span>
          <span>Applicant ranking</span>
          <span>Secure records</span>
          <span>Job posting management</span>
        </div>
      </section>

      <section className="landing-about" id="landing-about">
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">About LNU-HiRe</p>
          <h2>Built to keep recruitment organized, modern, and easy to follow</h2>
          <p>
            LNU-HiRe brings applicant screening, role matching, and communication into one clean workspace so
            hiring teams can spend less time sorting and more time choosing the right people.
          </p>
        </div>

        <div className="landing-about-grid">
          <article className="landing-about-card">
            <h3>For recruiters</h3>
            <p>Review stronger matches first, compare requirements quickly, and keep hiring decisions consistent.</p>
          </article>
          <article className="landing-about-card">
            <h3>For applicants</h3>
            <p>Apply through a simple flow that keeps credentials, uploads, and next steps easy to manage.</p>
          </article>
          <article className="landing-about-card">
            <h3>For administrators</h3>
            <p>Track postings, documents, and updates in a structured dashboard without extra manual work.</p>
          </article>
        </div>
      </section>

      <section className="landing-features" id="landing-features">
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">What it does</p>
          <h2>Everything your hiring workflow needs in one place</h2>
          <p>
            From document analysis to final shortlisting, LNU-HiRe keeps the process structured, fast, and easy
            to understand for both HR teams and applicants.
          </p>
        </div>

        <div className="landing-features-grid">
          <article className="landing-feature-card">
            <div className="landing-feature-icon">01</div>
            <h3>Resume & document analysis</h3>
            <p>Extract skills, education, and experience from submitted files without manual copy-paste work.</p>
          </article>

          <article className="landing-feature-card">
            <div className="landing-feature-icon">02</div>
            <h3>Requirement matching</h3>
            <p>Compare candidate profiles with job requirements to quickly identify strong fits and gaps.</p>
          </article>

          <article className="landing-feature-card">
            <div className="landing-feature-icon">03</div>
            <h3>Score and rank applicants</h3>
            <p>See a clear compatibility score so your team can review the strongest candidates first.</p>
          </article>

          <article className="landing-feature-card">
            <div className="landing-feature-icon">04</div>
            <h3>Secure records management</h3>
            <p>Keep applications, supporting files, and profile data organized in a single protected workspace.</p>
          </article>
        </div>
      </section>

      <section className="landing-how-it-works" id="landing-how-it-works">
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">How it works</p>
          <h2>A simple flow from posting to shortlist</h2>
          <p>We keep the process lightweight so hiring teams can move quickly without losing visibility.</p>
        </div>

        <div className="landing-steps">
          <article className="landing-step">
            <span className="landing-step-number">1</span>
            <h3>Post a role</h3>
            <p>Create your job posting with the skills, title, and requirements you actually care about.</p>
          </article>
          <article className="landing-step-arrow">→</article>
          <article className="landing-step">
            <span className="landing-step-number">2</span>
            <h3>Collect applications</h3>
            <p>Candidates upload resumes and documents that the system can read and organize automatically.</p>
          </article>
          <article className="landing-step-arrow">→</article>
          <article className="landing-step">
            <span className="landing-step-number">3</span>
            <h3>Review ranked matches</h3>
            <p>The dashboard highlights strong fits, weaker fits, and missing requirements at a glance.</p>
          </article>
        </div>
      </section>

      <section className="landing-jobs" id="landing-jobs">
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">Featured roles</p>
          <h2>See what is open right now</h2>
          <p>We surface a handful of active jobs so applicants can quickly explore current opportunities.</p>
        </div>

        <div className="landing-jobs-grid">
          {loadingLanding ? (
            <div className="landing-empty-state landing-full-span">
              <p>Loading job opportunities...</p>
            </div>
          ) : featuredJobs.length > 0 ? (
            featuredJobs.map((job) => {
              const skills = parseSkills(job.required_skills).slice(0, 4)
              return (
                <article key={job.id} className="landing-job-card">
                  <div className="landing-job-header">
                    <div>
                      <h3 className="landing-job-title">{job.title || "Untitled role"}</h3>
                      <p className="landing-job-company">{job.department || "Hiring team"}</p>
                    </div>
                    <span className="landing-job-badge">{job.type || "Full-time"}</span>
                  </div>

                  <p className="landing-job-location">📍 {job.location || "Philippines"}</p>
                  <p className="landing-job-description">
                    {job.description
                      ? job.description.slice(0, 120).replace(/\s+$/, "")
                      : "A featured opening from the active job board."}
                  </p>

                  {skills.length > 0 && (
                    <div className="landing-job-skills">
                      {skills.map((skill) => (
                        <span key={`${job.id}-${skill}`} className="landing-job-skill">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <button type="button" className="btn btn-primary btn-sm landing-job-action" onClick={onRegisterClick}>
                    Apply now
                  </button>
                </article>
              )
            })
          ) : (
            <div className="landing-empty-state landing-full-span">
              <p>No job opportunities available at the moment.</p>
            </div>
          )}
        </div>

        <div className="landing-jobs-footer">
          <button type="button" className="btn btn-primary btn-lg" onClick={onRegisterClick}>
            Browse all jobs
          </button>
        </div>
      </section>

      <section className="landing-cta-section">
          <div className="landing-cta-content">
            <p className="landing-section-eyebrow landing-cta-eyebrow">Ready to begin</p>
            <h2>Bring clarity to your hiring pipeline</h2>
          <p>
            Use LNU-HiRe to move from piles of files to a shortlist your team can act on confidently. 
            {summary ? ` You currently have ${summary.active_jobs} active openings and ${summary.total_applications} applications recorded.` : ""}
          </p>
          <div className="landing-cta-buttons">
            <button type="button" className="btn btn-primary btn-lg" onClick={onRegisterClick}>
              Create an account
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={onLoginClick}>
              Sign in
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer" id="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-section">
            <h4>LNU-HiRe</h4>
            <p>Intelligent recruitment made simple. Match the right candidates faster with less manual work.</p>
          </div>

          <div className="landing-footer-section">
            <h4>Quick links</h4>
            <button type="button" className="landing-footer-link" onClick={() => handleScrollTo("landing-features")}>
              Features
            </button>
            <button type="button" className="landing-footer-link" onClick={() => handleScrollTo("landing-how-it-works")}>
              How It Works
            </button>
            <button type="button" className="landing-footer-link" onClick={() => handleScrollTo("landing-jobs")}>
              Jobs
            </button>
            <button type="button" className="landing-footer-link" onClick={onLoginClick}>
              Login
            </button>
          </div>

          <div className="landing-footer-section">
            <h4>Contact</h4>
            <p>
              <strong>Phone:</strong> +639123456789
            </p>
            <p>
              <strong>Email:</strong> LNURecruitIQ@gmail.com
            </p>
          </div>

          <div className="landing-footer-section">
            <h4>Follow us</h4>
            <div className="landing-social-links">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="landing-social-icon" aria-label="Facebook">
                <img src={facebookIcon} alt="" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="landing-social-icon" aria-label="Instagram">
                <img src={instagramIcon} alt="" />
              </a>
            </div>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <p className="landing-copyright">&copy; 2026 LNU-HiRe. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}

export default LandingPage
