import React from 'react'
import { useEffect, useState } from "react"
import "../styles/JobSeekerDashboard.css"

const applicationPageSize = 10

function JobSeekerDashboard({ jobSeekerProfile, uploads = [], onBrowseJobs, onViewApplication, onDeleteApplication }) {
  const [actionsId, setActionsId] = useState(null)
  const [applicationsPage, setApplicationsPage] = useState(1)
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
  const applicationsPageCount = Math.max(1, Math.ceil(myUploads.length / applicationPageSize))
  const applicationsStart = myUploads.length === 0 ? 0 : ((applicationsPage - 1) * applicationPageSize) + 1
  const applicationsEnd = Math.min(myUploads.length, applicationsPage * applicationPageSize)
  const paginatedUploads = myUploads.slice(
    (applicationsPage - 1) * applicationPageSize,
    applicationsPage * applicationPageSize
  )

  const normalizeClassification = (value) => String(value || "").trim().toLowerCase()
  const isQualified = (value) => {
    const cls = normalizeClassification(value)
    return cls.includes("highly") || (cls === "qualified")
  }
  const isModeratelyQualified = (value) => {
    const cls = normalizeClassification(value)
    return cls.includes("moderately")
  }
  const isNotQualified = (value) => {
    const cls = normalizeClassification(value)
    return cls.includes("lowly") || cls.includes("not")
  }

  const totalApplications = myUploads.length
  const qualifiedCount = myUploads.filter((item) => isQualified(item.classification)).length
  const moderatelyQualifiedCount = myUploads.filter((item) => isModeratelyQualified(item.classification)).length
  const notQualifiedCount = myUploads.filter((item) => isNotQualified(item.classification)).length

  const getStatusLabel = (item) => {
    const rawStatus = String(item?.application_status || item?.applicationStatus || item?.evaluation_status || item?.evaluationStatus || "")
      .trim()
      .toLowerCase()
    const status = rawStatus === "for_evaluation"
      ? "interview"
      : rawStatus === "rated"
        ? "hired"
        : rawStatus
    if (["pending", "reviewed", "shortlisted", "interview", "rejected", "hired", "cancelled"].includes(status)) {
      return status
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    }
    return "Pending"
  }

  const getClassificationLabel = (item) => {
    const classification = String(item?.classification || "").trim()
    return classification || "Unclassified"
  }

  const classificationClass = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
    return normalized || "unclassified"
  }

  useEffect(() => {
    if (actionsId == null) return
    const onDocClick = () => setActionsId(null)
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [actionsId])

  useEffect(() => {
    setApplicationsPage(1)
  }, [emailKey])

  useEffect(() => {
    setApplicationsPage((page) => Math.min(page, applicationsPageCount))
  }, [applicationsPageCount])

  return (
    <section className="jobseeker-dashboard">
      <div className="js-welcome">
        <div>
          <h2>Welcomeback, {name}</h2>
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
            <span>Lowly Qualified</span>
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
                <th>Job Position</th>
                <th>Date Applied</th>
                <th>Classification</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {myUploads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="js-empty-row">No applications yet.</td>
                </tr>
              ) : (
                paginatedUploads.map((item) => {
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
                  const classificationLabel = getClassificationLabel(item)
                  return (
                    <tr key={`${item.id}-${jobTitle}`}>
                      <td>{jobTitle}</td>
                      <td>{dateLabel}</td>
                      <td className="js-classification-cell">
                        <span className={`js-status-pill status-${classificationClass(classificationLabel)}`}>
                          {classificationLabel}
                        </span>
                      </td>
                      <td>
                        <span className={`js-status-pill status-${statusLabel.toLowerCase().replace(/\s+/g, "-")}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td>
                        <div className="js-action-menu">
                          <button
                            type="button"
                            className="action-btn action-trigger"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActionsId((prev) => (prev === item.id ? null : item.id))
                            }}
                          >
                            ...
                          </button>
                          {actionsId === item.id && (
                            <div className="actions-menu" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="actions-menu-item"
                                onClick={() => {
                                  setActionsId(null)
                                  onViewApplication && onViewApplication(item)
                                }}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="actions-menu-item danger"
                                onClick={() => {
                                  setActionsId(null)
                                  onDeleteApplication && onDeleteApplication(item.id)
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          {myUploads.length > applicationPageSize && (
            <div className="js-applications-pagination">
              <span>
                Showing {applicationsStart}-{applicationsEnd} of {myUploads.length}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => setApplicationsPage((page) => Math.max(1, page - 1))}
                  disabled={applicationsPage === 1}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setApplicationsPage((page) => Math.min(applicationsPageCount, page + 1))}
                  disabled={applicationsPage === applicationsPageCount}
                >
                  Next
                </button>
              </div>
              <span>Page {applicationsPage} of {applicationsPageCount}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default JobSeekerDashboard
