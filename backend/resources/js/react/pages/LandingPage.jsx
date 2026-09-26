import React, { useEffect, useState } from "react"
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

function LandingPage({ onPersonnelLoginClick, onJobSeekerLoginClick, onRegisterClick, scrollToSectionId = "" }) {
  const [availableJobs, setAvailableJobs] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [jobsPage, setJobsPage] = useState(1)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const jobsPerPage = 6
  const jobsPageCount = Math.max(1, Math.ceil(availableJobs.length / jobsPerPage))
  const activeJobsPage = Math.min(jobsPage, jobsPageCount)
  const paginatedJobs = availableJobs.slice((activeJobsPage - 1) * jobsPerPage, activeJobsPage * jobsPerPage)

  const highlights = [
    "Personal Data Sheet(PDS) screening",
    "Applicant shortlisting",
    "Job posting tools",
    "Role-based workspace",
  ]

  const handleScrollTo = (id) => {
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const handleBackToTop = () => {
    handleScrollTo("landing-hero")
    document.scrollingElement?.scrollTo({ top: 0, behavior: "smooth" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  useEffect(() => {
    let isMounted = true

    const fetchJobs = async () => {
      try {
        const response = await fetch("/api/jobs")
        if (!response.ok) {
          throw new Error("Failed to load jobs")
        }
        const data = await response.json()
        if (!isMounted) return
        const jobs = Array.isArray(data) ? data : []
        setAvailableJobs(jobs.filter((job) => String(job?.status || "active").toLowerCase() === "active"))
      } catch {
        if (isMounted) {
          setAvailableJobs([])
        }
      } finally {
        if (isMounted) {
          setLoadingJobs(false)
        }
      }
    }

    fetchJobs()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!scrollToSectionId) return

    const frame = window.requestAnimationFrame(() => {
      handleScrollTo(scrollToSectionId)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [scrollToSectionId])

  useEffect(() => {
    setJobsPage((page) => Math.min(Math.max(1, page), jobsPageCount))
  }, [jobsPageCount])

  useEffect(() => {
    const updateBackToTop = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
      setShowBackToTop(scrollTop > 240)
    }

    updateBackToTop()
    window.addEventListener("scroll", updateBackToTop, { passive: true })
    return () => window.removeEventListener("scroll", updateBackToTop)
  }, [])

  return (
    <main className="landing-shell">
      <header className="landing-topbar">
        <button type="button" className="landing-brand" onClick={() => handleScrollTo("landing-hero")}>
          <img src={logoMark} alt="LNU-HiRe" className="landing-brand-logo" />
          <span className="landing-brand-copy">
            <span className="landing-brand-name">LNU-HiRe</span>
            {/* <span className="landing-brand-tagline">AI recruitment platform</span> */}
          </span>
        </button>

        <nav className="landing-nav" aria-label="Landing page">
          
          <button type="button" className="landing-nav-link" onClick={() => handleScrollTo("landing-jobs")}>
            Jobs
          </button>
          <button type="button" className="landing-nav-link" onClick={() => handleScrollTo("landing-features")}>
            Features
          </button>
          {/* <button type="button" className="landing-nav-link" onClick={() => handleScrollTo("landing-about")}>
            About
          </button> */}
          <button type="button" className="landing-nav-link" onClick={() => handleScrollTo("landing-how-it-works")}>
            How It Works
          </button>
          
          <button type="button" className="landing-nav-link" onClick={() => handleScrollTo("landing-footer")}>
            Contact
          </button>
        </nav>

        <div className="landing-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onPersonnelLoginClick}>
            Personnel/Admin Login
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onJobSeekerLoginClick}>
            Job Seeker Login
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onRegisterClick}>
            Register
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
          {/* <p className="landing-subtitle">
            Manage job posts, applicants, Personal Data Sheet(PDS) files, and evaluations in one simple place.
          </p> */}


          
            <section className="landing-about" id="landing-about">
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">About LNU-HiRe</p>
          <h2>Recruitment made easier to manage</h2>
          <p>One workspace for hiring teams and applicants.</p>
        </div>

        <div className="landing-about-grid">
          <article className="landing-about-card">
            <h3>For Human Resources</h3>
            <p>Review applicants faster.</p>
          </article>
          <article className="landing-about-card">
            <h3>For applicants</h3>
            <p>Apply with less hassle.</p>
          </article>

        </div>
      </section>
          
        </div>
      </section>

      {/* <section className="landing-trustbar" aria-label="Key capabilities">
        <div className="landing-trustbar-inner">
          <span>Personal Data Sheet(PDS) parsing</span>
          <span>Skill matching</span>
          <span>Applicant ranking</span>
          <span>Secure records</span>
          <span>Job posting management</span>
        </div>
      </section> */}

      <section className="landing-jobs" id="landing-jobs">
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">Available Jobs</p>
          <h2>Open positions</h2>
          <p>Browse current hiring opportunities.</p>
        </div>

        <div className="landing-jobs-grid">
          {loadingJobs ? (
            <div className="landing-empty-state landing-full-span">
              <p>Loading jobs...</p>
            </div>
          ) : availableJobs.length ? (
            paginatedJobs.map((job) => {
              const skills = parseSkills(job.required_skills).slice(0, 4)
              return (
                <article key={job.id || job.title} className="landing-job-card">
                  <div className="landing-job-header">
                    <div className="landing-job-heading">
                      <h3 className="landing-job-title">{job.title || "Untitled role"}</h3>
                      <p className="landing-job-company">{job.department || "Hiring team"}</p>
                    </div>
                    <span className="landing-job-badge">{job.type || "Full-time"}</span>
                  </div>

                  <p className="landing-job-description">
                    {job.description
                      ? job.description.slice(0, 90).replace(/\s+$/, "")
                      : "A featured opening from the active job board."}
                  </p>

                  <div className="landing-job-footer">
                    {skills.length > 0 && (
                      <div className="landing-job-skills">
                        {skills.map((skill) => (
                          <span key={`${job.id || job.title}-${skill}`} className="landing-job-skill">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    <button type="button" className="btn btn-primary btn-sm landing-job-action" onClick={onRegisterClick}>
                      Apply now
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="landing-empty-state landing-full-span">
              <p>No available jobs right now.</p>
            </div>
          )}
        </div>

        {availableJobs.length > jobsPerPage && (
          <div className="landing-jobs-footer" aria-label="Job pagination">
            <button
              type="button"
              className="landing-page-btn"
              onClick={() => setJobsPage((page) => Math.max(1, page - 1))}
              disabled={activeJobsPage <= 1}
            >
              Previous
            </button>
            <span className="landing-page-status">Page {activeJobsPage} of {jobsPageCount}</span>
            <button
              type="button"
              className="landing-page-btn"
              onClick={() => setJobsPage((page) => Math.min(jobsPageCount, page + 1))}
              disabled={activeJobsPage >= jobsPageCount}
            >
              Next
            </button>
          </div>
        )}
      </section>

      

      <section className="landing-features" id="landing-features">
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">What it does</p>
          <h2>Tools for daily hiring work</h2>
          <p>Screen, match, rank, and manage applicants.</p>
        </div>

        <div className="landing-features-grid">
          <article className="landing-feature-card">
            <div className="landing-feature-icon">01</div>
            <h3>Personal Data Sheet(PDS) & document analysis</h3>
            <p>Read submitted files faster.</p>
          </article>

          <article className="landing-feature-card">
            <div className="landing-feature-icon">02</div>
            <h3>Requirement matching</h3>
            <p>Compare applicants to job needs.</p>
          </article>

          <article className="landing-feature-card">
            <div className="landing-feature-icon">03</div>
            <h3>Score and rank applicants</h3>
            <p>Find stronger matches first.</p>
          </article>

          <article className="landing-feature-card">
            <div className="landing-feature-icon">04</div>
            <h3>Secure records management</h3>
            <p>Keep files and records together.</p>
          </article>
        </div>
      </section>

      <section className="landing-how-it-works" id="landing-how-it-works">
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">How it works</p>
          <h2>A simple flow from posting to shortlist</h2>
          <p>Three steps. Less confusion.</p>
        </div>

        <div className="landing-steps">
          <article className="landing-step">
            <span className="landing-step-number">1</span>
            <h3>Post a role</h3>
            <p>Add the role and requirements.</p>
          </article>
          <article className="landing-step-arrow">→</article>
          <article className="landing-step">
            <span className="landing-step-number">2</span>
            <h3>Collect applications</h3>
            <p>Receive Personal Data Sheet(PDS) files and other files.</p>
          </article>
          <article className="landing-step-arrow">→</article>
          <article className="landing-step">
            <span className="landing-step-number">3</span>
            <h3>Review ranked matches</h3>
            <p>Review the shortlist.</p>
          </article>
        </div>
      </section>

      

      {/* <section className="landing-cta-section">
          <div className="landing-cta-content">
            <p className="landing-section-eyebrow landing-cta-eyebrow">Ready to begin</p>
            <h2>Bring clarity to your hiring pipeline</h2>
          <p>
            Start managing recruitment in one place.
          </p>
          <div className="landing-cta-buttons">
            <button type="button" className="btn btn-primary btn-lg" onClick={onRegisterClick}>
              Create an account
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={onPersonnelLoginClick}>
              Personnel/Admin Login
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={onJobSeekerLoginClick}>
              Job Seeker Login
            </button>
          </div>
        </div>
      </section> */}

      <footer className="landing-footer" id="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-section">
            <h4>LNU-HiRe</h4>
            <p>Recruitment made simple.</p>
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
            <button type="button" className="landing-footer-link" onClick={onPersonnelLoginClick}>
              Personnel/Admin Login
            </button>
            <button type="button" className="landing-footer-link" onClick={onJobSeekerLoginClick}>
              Job Seeker Login
            </button>
          </div>

          <div className="landing-footer-section">
            <h4>Contact</h4>
            <p>
              <strong>Phone:</strong> +639123456789
            </p>
            <p>
              <strong>Email:</strong> lnuhire@gmail.com
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

      <button
        type="button"
        className={`landing-back-to-top ${showBackToTop ? "visible" : ""}`}
        onClick={handleBackToTop}
        aria-label="Back to top"
        title="Back to top"
      >
        <span aria-hidden="true">↑</span>
      </button>
    </main>
  )
}

export default LandingPage
