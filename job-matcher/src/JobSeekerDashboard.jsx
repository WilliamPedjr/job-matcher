import "./JobSeekerDashboard.css"

function JobSeekerDashboard({ jobSeekerProfile, uploads = [], onBrowseJobs, onViewApplication, onDeleteApplication }) {
  const name = jobSeekerProfile?.fullName || "Applicant"
  const email = jobSeekerProfile?.email || "-"
  const status = jobSeekerProfile?.status || "-"
  const emailKey = String(email || "").trim().toLowerCase()
  const myUploads = emailKey
    ? uploads.filter((item) => {
      const itemEmail = String(item.email || "").trim().toLowerCase()
      const appliedJob = String(item.applied_job_title || "").trim()
      return itemEmail === emailKey && appliedJob
    })
    : []

  const totalApplications = myUploads.length
  const qualifiedCount = myUploads.filter((item) => String(item.classification || "").toLowerCase().includes("qualified") && !String(item.classification || "").toLowerCase().includes("not")).length
  const moderatelyQualifiedCount = myUploads.filter((item) => String(item.classification || "").toLowerCase().includes("moderately")).length
  const notQualifiedCount = myUploads.filter((item) => String(item.classification || "").toLowerCase().includes("not qualified")).length

  const getStatusLabel = (item) => {
    const cls = String(item?.classification || "").toLowerCase()
    if (cls.includes("highly")) return "Qualified"
    if (cls.includes("moderately")) return "Moderately Qualified"
    if (cls.includes("not")) return "Not Qualified"
    return "Under Review"
  }

  return (
    <section className="jobseeker-dashboard">
      <div className="js-welcome">
        <div>
          <h2>Welcomeback, {name}</h2>
          <p>Track your job applications and see your qualification result.</p>
        </div>
        <div className="js-profile-chip">
          <div>
            <span className="js-chip-label">Email</span>
            <span>{email}</span>
          </div>
          <div>
            <span className="js-chip-label">Status</span>
            <span className={`js-chip-status ${String(status).toLowerCase()}`}>{status}</span>
          </div>
        </div>
      </div>

      <div className="js-section-title">Application Status Overview</div>

      <div className="js-stats-grid">
        <div className="js-stat-card">
          <div className="js-stat-label">
            <span className="js-icon js-icon-total">ALL</span>
            <span>Total Application Sent</span>
          </div>
          <div className="js-stat-value">{totalApplications}</div>
        </div>
        <div className="js-stat-card">
          <div className="js-stat-label">
            <span className="js-icon js-icon-qualified">OK</span>
            <span>Qualified</span>
          </div>
          <div className="js-stat-value">{qualifiedCount}</div>
        </div>
        <div className="js-stat-card">
          <div className="js-stat-label">
            <span className="js-icon js-icon-moderate">MID</span>
            <span>Moderately Qualified</span>
          </div>
          <div className="js-stat-value">{moderatelyQualifiedCount}</div>
        </div>
        <div className="js-stat-card">
          <div className="js-stat-label">
            <span className="js-icon js-icon-not">NO</span>
            <span>Not Qualified</span>
          </div>
          <div className="js-stat-value">{notQualifiedCount}</div>
        </div>
      </div>

      <div className="js-announcement-card">
        <div className="js-announcement-title">Announcement</div>
        <div className="js-announcement-body">
          <h3>Leyte Normal University is hiring!</h3>
          <p>
            New job openings are now available for application. Check out the latest opportunities and apply
            now for your desired position.
          </p>
          <button type="button" className="btn js-browse-btn" onClick={onBrowseJobs}>
            Browse Jobs
          </button>
        </div>
      </div>

      <div className="js-applied-card">
        <div className="js-section-title">Applied Jobs</div>
        <div className="js-applied-table">
          <table>
            <thead>
              <tr>
                <th>Job Title</th>
                <th>Date Applied</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {myUploads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="js-empty-row">No applications yet.</td>
                </tr>
              ) : (
                myUploads.map((item) => {
                  const jobTitle = item.applied_job_title || item.matched_job_title || "-"
                  const dateLabel = (() => {
                    const d = new Date(item.uploaded_at)
                    if (Number.isNaN(d.getTime())) return "-"
                    return d.toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric"
                    })
                  })()
                  const statusLabel = getStatusLabel(item)
                  return (
                    <tr key={`${item.id}-${jobTitle}`}>
                      <td>{jobTitle}</td>
                      <td>{dateLabel}</td>
                      <td>
                        <span className={`js-status-pill status-${statusLabel.toLowerCase().replace(/\s+/g, "-")}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td>
                        <div className="js-action-group">
                          <button
                            type="button"
                            className="js-action-btn"
                            onClick={() => onViewApplication && onViewApplication(item)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="js-action-btn js-action-btn-danger"
                            onClick={() => onDeleteApplication && onDeleteApplication(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default JobSeekerDashboard
