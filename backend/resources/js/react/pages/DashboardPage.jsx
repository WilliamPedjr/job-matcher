import React from 'react'
import "../styles/DashboardPage.css"
import { useMemo, useState } from "react"

function DashboardPage({
  dashboardData,
  onViewAllJobs,
  onViewAllApplicants,
  onViewApplicant
}) {
  const [selectedJobTitle, setSelectedJobTitle] = useState("all")
  const [isTopApplicantsModalOpen, setIsTopApplicantsModalOpen] = useState(false)

  const jobOptions = useMemo(() => {
    const jobs = Array.isArray(dashboardData?.applicantJobs) ? dashboardData.applicantJobs : []
    return [
      { value: "all", label: "All Jobs" },
      ...jobs.map((job) => ({ value: job.title, label: `${job.title} (${job.total})` }))
    ]
  }, [dashboardData?.applicantJobs])

  const selectedJobStats = useMemo(() => {
    const jobs = Array.isArray(dashboardData?.applicantJobs) ? dashboardData.applicantJobs : []
    if (selectedJobTitle === "all") {
      return {
        highlyQualified: Number(dashboardData?.highlyQualified || 0),
        moderatelyQualified: Number(dashboardData?.moderatelyQualified || 0),
        notQualified: Number(dashboardData?.notQualified || 0),
        total: Number(dashboardData?.totalApplicants || 0)
      }
    }
    const selected = jobs.find((job) => job.title === selectedJobTitle)
    return {
      highlyQualified: Number(selected?.highlyQualified || 0),
      moderatelyQualified: Number(selected?.moderatelyQualified || 0),
      notQualified: Number(selected?.notQualified || 0),
      total: Number(selected?.total || 0)
    }
  }, [dashboardData, selectedJobTitle])

  return (
    <section className="dashboard-page">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
      </div>

      <div className="dashboard-kpis">
        <article className="kpi-card kpi-large">
          <div className="kpi-head">
            <h4>Active Jobs</h4>
            <span className="kpi-icon">📄</span>
          </div>
          <p>{dashboardData.openJobs}</p>
        </article>
        <article className="kpi-card kpi-large">
          <div className="kpi-head">
            <h4>Total Applicants Applied</h4>
            <span className="kpi-icon">🧑‍💼</span>
          </div>
          <p>{dashboardData.totalApplicants}</p>
        </article>
      </div>

      <div className="dashboard-analytics">
        <section className="analytics-card">
          <div className="analytics-card-head">
            <h3>Applicant Classification Distribution</h3>
            <select
              className="analytics-select"
              value={selectedJobTitle}
              onChange={(e) => setSelectedJobTitle(e.target.value)}
            >
              {jobOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="graph graph-centered">
            {(() => {
              const qualified = Number(selectedJobStats.highlyQualified || 0)
              const moderate = Number(selectedJobStats.moderatelyQualified || 0)
              const notQualified = Number(selectedJobStats.notQualified || 0)
              const totalCount = Number(selectedJobStats.total || 0)
              if (selectedJobTitle !== "all" && totalCount === 0) {
                return <p className="muted">No applicants found for this job yet.</p>
              }
              const total = qualified + moderate + notQualified || 1
              const qualifiedPct = Math.round((qualified / total) * 100)
              const moderatePct = Math.round((moderate / total) * 100)
              const notPct = Math.max(0, 100 - qualifiedPct - moderatePct)
              return (
                <div className="donut-wrap">
                  <div
                    className="donut-chart"
                    style={{
                      background: `conic-gradient(#22c55e 0% ${qualifiedPct}%, #f59e0b ${qualifiedPct}% ${qualifiedPct + moderatePct}%, #ef4444 ${qualifiedPct + moderatePct}% 100%)`
                    }}
                  />
                  <ul className="donut-legend">
                    <li>
                      <span className="dot dot-green" />
                      Qualified
                      <strong>{qualified} ({qualifiedPct}%)</strong>
                    </li>
                    <li>
                      <span className="dot dot-amber" />
                      Moderately Qualified
                      <strong>{moderate} ({moderatePct}%)</strong>
                    </li>
                    <li>
                      <span className="dot dot-red" />
                      Not Qualified
                      <strong>{notQualified} ({notPct}%)</strong>
                    </li>
                  </ul>
                </div>
              )
            })()}
          </div>
        </section>

        <section className="analytics-card">
          <div className="analytics-card-head">
            <h3>Application Trends</h3>
            {(() => {
              const points = dashboardData.applicantsByMonth || []
              if (points.length === 0) {
                return null
              }
              const firstLabel = points[0]?.label || "Start"
              const lastLabel = points[points.length - 1]?.label || "Now"
              return (
                <p className="analytics-sub">
                  {firstLabel} - {lastLabel}
                </p>
              )
            })()}
          </div>
          <div className="graph">
            {(() => {
              const points = dashboardData.applicantsByMonth
              const maxCount = Math.max(1, ...points.map((item) => Number(item.count || 0)))
              const roundedMax = Math.max(10, Math.ceil(maxCount / 10) * 10)
              const width = 640
              const height = 220
              const paddingX = 36
              const paddingY = 20
              const usableWidth = width - paddingX * 2
              const usableHeight = height - paddingY * 2
              const step = points.length > 1 ? usableWidth / (points.length - 1) : 0
              const coords = points.map((item, index) => {
                const value = Number(item.count || 0)
                const x = paddingX + step * index
                const y = paddingY + (1 - value / roundedMax) * usableHeight
                return { ...item, x, y, value }
              })
              const path = coords
                .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
                .join(" ")
              const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = paddingY + usableHeight * ratio
                const value = Math.round(roundedMax * (1 - ratio))
                return { y, value }
              })

              return (
                <div className="line-chart trend-chart">
                  <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
                    {gridLines.map((line) => (
                      <g key={`grid-${line.value}`}>
                        <line
                          x1={paddingX}
                          x2={width - paddingX}
                          y1={line.y}
                          y2={line.y}
                          className="trend-grid"
                        />
                        <text x={8} y={line.y + 4} className="trend-label">
                          {line.value}
                        </text>
                      </g>
                    ))}
                    <path d={path} className="trend-line" />
                  </svg>
                  <div className="trend-dates" aria-hidden="true">
                    {coords.map((point, index) => (
                      <span
                        key={`trend-date-${point.key || index}`}
                        className={`trend-date ${index % 2 === 0 ? "trend-date-strong" : ""}`}
                      >
                        {point.label}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </section>
      </div>

      <section className="dashboard-panel dashboard-top-applicants">
        <div className="dashboard-panel-head">
          <h3>Top Applicant per Job</h3>
          <button
            type="button"
            className="dashboard-link-btn"
            onClick={() => setIsTopApplicantsModalOpen(true)}
          >
            View All →
          </button>
        </div>
        {dashboardData.topApplicantsByJob?.length === 0 ? (
          <p className="muted">No applicants ranked by job yet.</p>
        ) : (
          <div className="top-applicants-grid">
            {dashboardData.topApplicantsByJob.map(({ jobTitle, applicant, totalApplicants }) => {
              const cls = String(applicant?.classification || "").toLowerCase()
              const pillClass = cls.includes("not")
                ? "dash-pill-bad"
                : cls.includes("moderately")
                  ? "dash-pill-warn"
                  : "dash-pill-good"

              return (
                <article key={`top-applicant-${jobTitle}`} className="top-applicant-card">
                  <div className="top-applicant-job">
                    <span>{jobTitle}</span>
                    <strong>{totalApplicants} applicant{totalApplicants === 1 ? "" : "s"}</strong>
                  </div>
                  <div className="top-applicant-person">
                    <div>
                      <p className="dashboard-item-title">{applicant?.name || "(No name)"}</p>
                      <p className="dashboard-item-subtitle">{applicant?.email || "No email"}</p>
                    </div>
                    <button
                      type="button"
                      className={`dash-pill ${pillClass}`}
                      onClick={() => onViewApplicant(applicant)}
                    >
                      {applicant?.match_score != null ? `${Number(applicant.match_score).toFixed(0)}%` : "View"}
                    </button>
                  </div>
                  <div className="top-applicant-foot">
                    <span>{applicant?.classification || "Unclassified"}</span>
                    <button type="button" onClick={() => onViewApplicant(applicant)}>View Summary</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {isTopApplicantsModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTopApplicantsModalOpen(false)}>
          <div className="modal-card modal-modern top-applicants-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Top Applicant per Job</h3>
                <p className="top-applicants-modal-subtitle">Highest-ranked applicant for each job position.</p>
              </div>
              <button type="button" className="close-x" onClick={() => setIsTopApplicantsModalOpen(false)}>×</button>
            </div>

            {dashboardData.topApplicantsByJob?.length === 0 ? (
              <p className="muted">No applicants ranked by job yet.</p>
            ) : (
              <div className="top-applicants-modal-table-wrap">
                <table className="top-applicants-modal-table">
                  <thead>
                    <tr>
                      <th>Job Position</th>
                      <th>Top Applicant</th>
                      <th>Total Applicants</th>
                      <th>Classification</th>
                      <th>Score</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.topApplicantsByJob.map(({ jobTitle, applicant, totalApplicants }) => {
                      const cls = String(applicant?.classification || "").toLowerCase()
                      const pillClass = cls.includes("not")
                        ? "dash-pill-bad"
                        : cls.includes("moderately")
                          ? "dash-pill-warn"
                          : "dash-pill-good"

                      return (
                        <tr key={`top-applicant-modal-${jobTitle}`}>
                          <td>{jobTitle}</td>
                          <td>
                            <div className="applicant-cell">
                              <strong>{applicant?.name || "(No name)"}</strong>
                              <span>{applicant?.email || "No email"}</span>
                            </div>
                          </td>
                          <td>{totalApplicants}</td>
                          <td>
                            <span className={`dash-pill ${pillClass}`}>
                              {applicant?.classification || "Unclassified"}
                            </span>
                          </td>
                          <td>{applicant?.match_score != null ? `${Number(applicant.match_score).toFixed(0)}%` : "-"}</td>
                          <td>
                            <button
                              type="button"
                              className="top-applicants-view-btn"
                              onClick={() => {
                                setIsTopApplicantsModalOpen(false)
                                onViewApplicant(applicant)
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <section className="dashboard-panel dashboard-trending-jobs">
        <div className="dashboard-panel-head">
          <h3>Most Trending Jobs</h3>
          <button type="button" className="dashboard-link-btn" onClick={onViewAllJobs}>View All →</button>
        </div>
        {dashboardData.topJobsByApplicants?.length === 0 ? (
          <p className="muted">No job applications yet.</p>
        ) : (
          <div className="trending-jobs-list">
            {dashboardData.topJobsByApplicants.map((job, index) => {
              const maxApplicants = Math.max(1, ...dashboardData.topJobsByApplicants.map((item) => Number(item.applicants || 0)))
              const width = Math.max(8, Math.round((Number(job.applicants || 0) / maxApplicants) * 100))
              const qualifiedTotal = Number(job.highlyQualified || 0) + Number(job.moderatelyQualified || 0)

              return (
                <article key={`trending-job-${job.title}`} className="trending-job-row">
                  <div className="trending-job-rank">{index + 1}</div>
                  <div className="trending-job-main">
                    <div className="trending-job-head">
                      <div>
                        <p className="dashboard-item-title">{job.title}</p>
                        <p className="dashboard-item-subtitle">{qualifiedTotal} qualified or moderate applicants</p>
                      </div>
                      <strong>{Number(job.applicants || 0)} applied</strong>
                    </div>
                    <div className="trending-job-bar" aria-hidden="true">
                      <span style={{ width: `${width}%` }} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>Available Job Positions</h3>
            <button type="button" className="dashboard-link-btn" onClick={onViewAllJobs}>View All →</button>
          </div>
          {dashboardData.recentJobs.length === 0 ? <p className="muted">No job posts yet.</p> : (
            <ul className="dashboard-list">
              {dashboardData.recentJobs.map((job) => (
                <li key={`dash-job-${job.id}`} className="dashboard-list-item">
                  <div>
                    <p className="dashboard-item-title">{job.title}</p>
                    <p className="dashboard-item-subtitle">{job.department || "-"}</p>
                  </div>
                  <div className="dashboard-badges">
                    <span className="dash-chip">{Number(job.applicants || 0)} applicants</span>
                    <span className={`dash-chip ${String(job.status || "active").toLowerCase() === "active" ? "chip-active" : "chip-closed"}`}>
                      {String(job.status || "active").toLowerCase()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>Recently Applied Applicants</h3>
            <button type="button" className="dashboard-link-btn" onClick={onViewAllApplicants}>View All →</button>
          </div>
          {dashboardData.recentApplicants.length === 0 ? <p className="muted">No applicants yet.</p> : (
            <ul className="dashboard-list">
              {dashboardData.recentApplicants.map((item) => (
                <li key={`dash-app-${item.id}`} className="dashboard-list-item">
                  <div>
                    <p className="dashboard-item-title">{item.name || "(No name)"}</p>
                    <p className="dashboard-item-subtitle">{item.applied_job_title || item.matched_job_title || "-"}</p>
                  </div>
                  <button
                    type="button"
                    className={`dash-pill ${
                      String(item.classification || "").toLowerCase().includes("not")
                        ? "dash-pill-bad"
                        : String(item.classification || "").toLowerCase().includes("moderately")
                          ? "dash-pill-warn"
                          : "dash-pill-good"
                    }`}
                    onClick={() => onViewApplicant(item)}
                  >
                    {item.classification || "Unclassified"} {item.match_score != null ? `(${Number(item.match_score).toFixed(0)}%)` : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}

export default DashboardPage
