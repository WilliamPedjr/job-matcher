import "./App.css"

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
        <article className="kpi-card">
          <h4>Open Jobs</h4>
          <p>{dashboardData.openJobs}</p>
        </article>
        <article className="kpi-card">
          <h4>Total Applicants</h4>
          <p>{dashboardData.totalApplicants}</p>
        </article>
        <article className="kpi-card kpi-good">
          <h4>Highly Qualified</h4>
          <p>{dashboardData.highlyQualified}</p>
        </article>
        <article className="kpi-card kpi-warn">
          <h4>Moderately Qualified</h4>
          <p>{dashboardData.moderatelyQualified}</p>
        </article>
        <article className="kpi-card kpi-bad">
          <h4>Not Qualified</h4>
          <p>{dashboardData.notQualified}</p>
        </article>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>Recent Job Postings</h3>
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
            <h3>Recent Applicants</h3>
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
