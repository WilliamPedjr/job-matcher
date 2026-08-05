import React from 'react'
import '../styles/HelpPage.css'

const requiredSupportingKeys = ['certificate', 'portfolio', 'recommendation', 'transcript']

const jobSeekerSetupItems = [
  {
    key: 'profile-opened',
    page: 'profile',
    title: 'Open your Profile page',
    body: 'Start in Profile and review your name, email, and basic account information.'
  },
  {
    key: 'contact-details',
    page: 'profile',
    title: 'Add phone number and address',
    body: 'Use Edit Profile to add your phone number, address, about section, education, and experience.'
  },
  {
    key: 'resume',
    page: 'profile',
    title: 'Upload your resume',
    body: 'Save your resume once so the system can use it when you apply for jobs.'
  },
  {
    key: 'supporting',
    page: 'profile',
    title: 'Upload supporting documents',
    body: 'Add certificates, portfolio, application letter, transcript, and other documents needed for applications.'
  },
  {
    key: 'jobs',
    page: 'jobs',
    title: 'Discover the Jobs page',
    body: 'Browse openings, view job details, and apply when your resume and documents are ready.'
  },
  {
    key: 'applications',
    page: 'dashboard',
    title: 'Track progress on Dashboard',
    body: 'After applying, use Dashboard to monitor applications, statuses, and qualification results.'
  }
]

const jobSeekerPages = [
  ['Dashboard', 'Track submitted applications, dates applied, qualification results, and application actions.'],
  ['Jobs', 'Browse job openings, view job details, and apply using your saved resume and documents.'],
  ['Profile', 'Update personal information, phone number, address, resume, documents, education, and experience.'],
  ['Help', 'Review setup steps and page guidance whenever you need a reminder.']
]

function HelpPage({
  isJobSeeker = false,
  jobSeekerId = null,
  jobSeekerProfile = null,
  jobSeekerResume = null,
  jobSeekerSupporting = [],
  jobSeekerApplications = [],
  onOpenSetupGuide,
  onGoToPage
}) {
  if (!isJobSeeker) {
    return (
      <section className="help-page" aria-label="Help">
        <div className="help-hero">
          <div>
            <span className="help-kicker">Help Center</span>
            <h2>Recruitment workspace guide</h2>
            <p>Use the dashboard, jobs, applicants, ratings, users, and archive pages to manage the hiring workflow.</p>
          </div>
        </div>
      </section>
    )
  }

  const visitedPage = (page) => Boolean(
    jobSeekerId && window.localStorage.getItem(`jobSeekerPageVisited:${jobSeekerId}:${page}`) === 'true'
  )
  const hasProfileBasics = Boolean(jobSeekerProfile?.fullName || jobSeekerProfile?.full_name || jobSeekerProfile?.email)
  const hasContactDetails = Boolean(
    String(jobSeekerProfile?.phone || '').trim() &&
    String(jobSeekerProfile?.address || jobSeekerProfile?.location || '').trim()
  )
  const supportingTypes = new Set(
    (Array.isArray(jobSeekerSupporting) ? jobSeekerSupporting : [])
      .map((file) => String(file?.type || '').trim())
      .filter(Boolean)
  )
  const hasRequiredSupporting = requiredSupportingKeys.every((key) => supportingTypes.has(key))
  const hasResume = Boolean(jobSeekerResume)
  const hasViewedProfile = visitedPage('profile') || hasProfileBasics
  const hasViewedJobs = visitedPage('jobs') || jobSeekerApplications.length > 0
  const hasApplications = jobSeekerApplications.length > 0
  const stepDone = {
    'profile-opened': hasViewedProfile,
    'contact-details': hasContactDetails,
    resume: hasResume,
    supporting: hasRequiredSupporting,
    jobs: hasViewedJobs,
    applications: visitedPage('dashboard') || hasApplications
  }

  const completedCount = jobSeekerSetupItems.filter((item) => stepDone[item.key]).length

  return (
    <section className="help-page" aria-label="Job seeker help">
      <div className="help-hero">
        <div>
          <span className="help-kicker">Job Seeker Help</span>
          <h2>Follow the setup walkthrough</h2>
          <p>Start with your Profile, prepare your documents, then discover where to browse jobs and track applications.</p>
          <div className="help-progress" aria-label={`${completedCount} of ${jobSeekerSetupItems.length} setup steps completed`}>
            <span>{completedCount}/{jobSeekerSetupItems.length} done</span>
            <div>
              <i style={{ width: `${(completedCount / jobSeekerSetupItems.length) * 100}%` }} />
            </div>
          </div>
        </div>
        <button type="button" className="btn help-hero-btn" onClick={onOpenSetupGuide}>
          Open Setup Guide
        </button>
      </div>

      <div className="help-grid">
        <section className="help-panel">
          <div className="help-panel-head">
            <h3>Step-by-Step Setup</h3>
          </div>
          <div className="help-steps">
            {jobSeekerSetupItems.map((item, index) => {
              const isDone = Boolean(stepDone[item.key])
              return (
              <button
                key={item.title}
                type="button"
                className={`help-step ${isDone ? 'is-done' : 'is-pending'}`}
                onClick={() => onGoToPage?.(item.page)}
              >
                <span>{isDone ? 'OK' : index + 1}</span>
                <div>
                  <strong>
                    {item.title}
                    <em>{isDone ? 'Done' : 'Pending'}</em>
                  </strong>
                  <p>{item.body}</p>
                </div>
              </button>
              )
            })}
          </div>
        </section>

        <section className="help-panel">
          <div className="help-panel-head">
            <h3>Page Guide</h3>
          </div>
          <div className="help-page-list">
            {jobSeekerPages.map(([title, body]) => (
              <div key={title}>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

export default HelpPage
