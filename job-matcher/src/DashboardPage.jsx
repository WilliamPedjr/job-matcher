import "./DashboardPage.css"

function DashboardPage({
  dashboardData,
  onViewAllJobs,
  onViewAllApplicants,
  onViewApplicant
}) {
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
            <h4>Total Applicants</h4>
            <span className="kpi-icon">🧑‍💼</span>
          </div>
          <p>{dashboardData.totalApplicants}</p>
        </article>
      </div>

      <div className="dashboard-analytics">
        <section className="analytics-card">
          <div className="analytics-card-head">
            <h3>Applicant Classification Distribution</h3>
          </div>
          <div className="graph graph-centered">
            {(() => {
              const qualified = Number(dashboardData.highlyQualified || 0)
              const moderate = Number(dashboardData.moderatelyQualified || 0)
              const notQualified = Number(dashboardData.notQualified || 0)
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
