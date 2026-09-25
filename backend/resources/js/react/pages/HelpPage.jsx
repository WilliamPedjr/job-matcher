import React from 'react'
import '../styles/HelpPage.css'

const requiredSupportingKeys = ['certificate', 'portfolio', 'transcript']

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
    body: 'Add certificates, portfolio, transcript, and other reusable documents. Application letters are added when applying.'
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
  ['Jobs', 'Browse job openings, view job details, and apply using your saved resume, reusable documents, and an application letter.'],
  ['Profile', 'Update personal information, phone number, address, resume, documents, education, and experience.'],
  ['Help', 'Review setup steps and page guidance whenever you need a reminder.']
]

const jobSeekerGuidelines = [
  {
    title: 'PDS Guidelines',
    downloads: [
      {
        fileName: 'CS-Form-No.-212-Revised-2026-Personal-Data-Sheet-PDS.xlsx',
        href: '/guidelines/CS-Form-No.-212-Revised-2026-Personal-Data-Sheet-PDS.xlsx'
      },
      {
        fileName: 'Guide-to-Filling-Up-the-Personal-Data-Sheet-Revised-2026.pdf',
        href: '/guidelines/Guide-to-Filling-Up-the-Personal-Data-Sheet-Revised-2026.pdf'
      }
    ],
    intro: 'Use this when filling out your Personal Data Sheet before uploading it with your application.',
    tips: [
    ]
  },
  {
    title: 'Work Experience Sheet Guidelines',
    downloads: [
      {
        fileName: 'CS-Form-No.-212-Attachment-Work-Experience-Sheet-Updated-July-10-2026.docx',
        href: '/guidelines/CS-Form-No.-212-Attachment-Work-Experience-Sheet-Updated-July-10-2026.docx'
      }
    ],
    intro: 'Use this to describe your previous roles in a way the recruitment team can evaluate consistently.',
    tips: []
  }
]

const personnelGuideItems = [
  ['Review the Dashboard', 'Start with Dashboard to scan recent activity, application totals, job counts, and recruitment progress.'],
  ['Manage job posts', 'Use Jobs to create openings, update job details, view applicants for a position, and archive closed records.'],
  ['Evaluate applicants', 'Use Applications and Ratings / Evaluation to review qualification results, move applicants through statuses, and record panel ratings.'],
  ['Maintain records', 'Use Users for personnel and job seeker accounts, Archive for restored records, and Profile for your own account details.']
]

const personnelPages = [
  ['Dashboard', 'Overview of recruitment activity, jobs, applicants, and recent system actions.'],
  ['Jobs', 'Create, edit, view, and archive job postings and view applicants by job.'],
  ['Applications', 'Review applicant details, qualification scores, documents, and application statuses.'],
  ['Ratings / Evaluation', 'Manage interview or rating workflows for shortlisted applicants.'],
  ['Users', 'Manage job seeker and personnel accounts.'],
  ['Archive', 'Restore archived jobs, job seekers, and other recoverable records.'],
  ['Profile', 'Edit your personnel account information and password.']
]

function HelpPage({
  isJobSeeker = false,
  jobSeekerId = null,
  jobSeekerProfile = null,
  jobSeekerResume = null,
  jobSeekerSupporting = [],
  jobSeekerApplications = [],
  onGoToPage
}) {
  if (!isJobSeeker) {
    return (
      <section className="help-page" aria-label="Help">
        <div className="help-hero">
          <div>
            <span className="help-kicker">Help Center</span>
            <h2>Recruitment workspace guide</h2>
            <p>Use this brief guide to move through the main personnel workflows.</p>
          </div>
        </div>

        <div className="help-grid">
          <section className="help-panel">
            <div className="help-panel-head">
              <h3>Brief Guide</h3>
            </div>
            <div className="help-steps">
              {personnelGuideItems.map(([title, body], index) => (
                <button
                  key={title}
                  type="button"
                  className="help-step is-pending"
                  onClick={() => {
                    const pageMap = ['dashboard', 'jobs', 'applicants', 'users']
                    onGoToPage?.(pageMap[index] || 'dashboard')
                  }}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="help-panel">
            <div className="help-panel-head">
              <h3>Page Guide</h3>
            </div>
            <div className="help-page-list">
              {personnelPages.map(([title, body]) => (
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
  const downloadGuidelineFiles = (downloads = []) => {
    downloads.forEach((file, index) => {
      window.setTimeout(() => {
        const link = document.createElement('a')
        link.href = file.href
        link.download = file.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }, index * 150)
    })
  }

  return (
    <section className="help-page" aria-label="Job seeker help">
      <div className="help-hero">
          <div>
            <span className="help-kicker">Job Seeker Help</span>
          <h2>Follow your setup checklist</h2>
          <div className="help-progress" aria-label={`${completedCount} of ${jobSeekerSetupItems.length} setup steps completed`}>
            <span>{completedCount}/{jobSeekerSetupItems.length} done</span>
            <div>
              <i style={{ width: `${(completedCount / jobSeekerSetupItems.length) * 100}%` }} />
            </div>
          </div>
        </div>
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

      <section className="help-panel help-guidelines-panel">
        <div className="help-panel-head">
          <h3>Form Guidelines</h3>
        </div>
        <div className="help-guidelines-list">
          {jobSeekerGuidelines.map((guide) => (
            <article key={guide.title} className="help-guideline-card">
              <div className="help-guideline-top">
                <div>
                  <strong>{guide.title}</strong>
                  <p>{guide.intro}</p>
                </div>
                <button
                  type="button"
                  className="help-download-btn"
                  onClick={() => downloadGuidelineFiles(guide.downloads)}
                >
                  Download
                </button>
              </div>
              <ul>
                {guide.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

export default HelpPage
