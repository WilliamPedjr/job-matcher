// React imports
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import LoginPage from './LoginPage'
import ApplicantViewPage from './ApplicantViewPage'
import JobPostingPage from './JobPostingPage'
import DashboardPage from './DashboardPage'
import CustomDropdown from './CustomDropdown'

function App() {
  const ADMIN_EMAIL = "admin"
  const ADMIN_PASSWORD = "123"
  const EMPLOYER_EMAIL = "01"
  const EMPLOYER_PASSWORD = "123"

  // Component state
  // Holds the currently selected file from the file input.
  const [file, setFile] = useState(null)
  // Stores applicant name/email/phone from the upload modal.
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  // Stores user-facing status text (success, failure, validation errors).
  const [message, setMessage] = useState("")
  // Controls upload modal visibility.
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  // Keeps upload records returned by GET /uploads.
  const [uploads, setUploads] = useState([])
  const [jobPosts, setJobPosts] = useState([])
  const [isLoadingUploads, setIsLoadingUploads] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "desc" })
  const [actionsMenu, setActionsMenu] = useState(null)
  const [viewItem, setViewItem] = useState(null)
  const [activePage, setActivePage] = useState("applicants")
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem("isAuthenticated") === "true")
  const [userRole, setUserRole] = useState(() => localStorage.getItem("userRole") || "")
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [uploadStatus, setUploadStatus] = useState("")
  const [uploadNotice, setUploadNotice] = useState("")
  const [appliedJobTitle, setAppliedJobTitle] = useState("")
  const [jobFilter, setJobFilter] = useState("all")
  const isEmployer = userRole === "employer"
  const normalizedPhone = phone.length ? `+63${phone}` : ""

  useEffect(() => {
    if (!uploadStatus) return
    const timer = setTimeout(() => {
      setUploadStatus("")
      setUploadNotice("")
    }, 2600)
    return () => clearTimeout(timer)
  }, [uploadStatus])

  const showUploadNotice = (status, notice) => {
    setUploadStatus(status)
    setUploadNotice(notice)
  }

  // Fetch all upload records
  const fetchUploads = async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoadingUploads(true)
    }
    try {
      const response = await fetch("http://localhost:5000/uploads")
      if (!response.ok) {
        throw new Error("Failed to fetch uploads.")
      }
      const data = await response.json()
      setUploads(data)
    } catch (error) {
      setMessage("Could not load upload records.")
    } finally {
      if (!silent) {
        setIsLoadingUploads(false)
      }
    }
  }

  const fetchJobPosts = async () => {
    try {
      const response = await fetch("http://localhost:5000/jobs")
      if (!response.ok) {
        throw new Error("Failed to fetch job posts.")
      }
      const data = await response.json()
      setJobPosts(Array.isArray(data) ? data : [])
    } catch (error) {
      setMessage("Could not load job posts.")
    }
  }

  const openAddApplicantModal = async () => {
    await fetchJobPosts()
    setIsUploadModalOpen(true)
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchUploads()
      fetchJobPosts()
    }
  }, [isAuthenticated])

  useEffect(() => {
    const closeActions = () => setActionsMenu(null)
    document.addEventListener("click", closeActions)
    window.addEventListener("resize", closeActions)
    window.addEventListener("scroll", closeActions, true)

    return () => {
      document.removeEventListener("click", closeActions)
      window.removeEventListener("resize", closeActions)
      window.removeEventListener("scroll", closeActions, true)
    }
  }, [])

  const openActionsMenu = (event, item) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setActionsMenu({
      item,
      top: rect.bottom + 6,
      left: Math.max(12, rect.right - 140)
    })
  }

  const handleLogin = (e) => {
    e.preventDefault()
    const email = loginEmail.trim().toLowerCase()

    if (email === ADMIN_EMAIL && loginPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      localStorage.setItem("isAuthenticated", "true")
      setUserRole("admin")
      localStorage.setItem("userRole", "admin")
      setActivePage("dashboard")
      setLoginError("")
      setLoginPassword("")
      return
    }

    if (email === EMPLOYER_EMAIL && loginPassword === EMPLOYER_PASSWORD) {
      setIsAuthenticated(true)
      localStorage.setItem("isAuthenticated", "true")
      setUserRole("employer")
      localStorage.setItem("userRole", "employer")
      setActivePage("jobs")
      setLoginError("")
      setLoginPassword("")
      return
    }

    setLoginError("Invalid email or password.")
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem("isAuthenticated")
    setUserRole("")
    localStorage.removeItem("userRole")
    setActionsMenu(null)
    setViewItem(null)
    setActivePage("applicants")
  }

  const handleTopNav = (page) => {
    setActivePage(page)
    setActionsMenu(null)
    setIsUploadModalOpen(false)
    if (page !== "applicants") {
      setViewItem(null)
    }
  }

  // File input handler
  const handleFileChange = (e) => {
    // Keep only the first selected file since this uploader is single-file.
    setFile(e.target.files[0])
  }

  const handlePhoneChange = (value) => {
    const digitsOnly = String(value || "").replace(/\D/g, "")
    const withoutCountryPrefix = digitsOnly.startsWith("63") ? digitsOnly.slice(2) : digitsOnly
    const withoutLocalPrefix = withoutCountryPrefix.startsWith("0")
      ? withoutCountryPrefix.slice(1)
      : withoutCountryPrefix
    setPhone(withoutLocalPrefix.slice(0, 10))
  }

  // File upload handler
  const handleUpload = async () => {
    // Prevent upload attempts when required values are missing.
    if (!name.trim() || !email.trim() || !phone.trim() || !appliedJobTitle.trim()) {
      showUploadNotice("fail", "Please fill in all fields.")
      return
    }
    if (phone.length !== 10) {
      showUploadNotice("fail", "Phone number must be exactly 10 digits after +63.")
      return
    }

    if (!file) {
      showUploadNotice("fail", "Please upload a resume/CV file.")
      return
    }

    // Build multipart/form-data payload for backend upload endpoint.
    const formData = new FormData()
    formData.append("name", name.trim())
    formData.append("email", email.trim())
    formData.append("phone", normalizedPhone)
    formData.append("appliedJobTitle", appliedJobTitle.trim())
    formData.append("file", file)

    try {
      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData
      })

      if (response.ok) {
        showUploadNotice("success", "Applicant analyzed and added successfully.")
        setIsUploadModalOpen(false)
        setFile(null)
        setName("")
        setEmail("")
        setPhone("")
        setAppliedJobTitle("")
        fetchUploads()
      } else {
        const payload = await response.json().catch(() => null)
        showUploadNotice("fail", payload?.message || "Failed to add applicant.")
      }
    } catch (error) {
      // Handles network/server errors where fetch throws before a response exists.
      showUploadNotice("fail", "Failed to add applicant.")
    }
  }

  // Delete record handler
  const handleDelete = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/uploads/${id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        setMessage("Failed to delete record.")
        return false
      }

      // Update UI immediately so Jobs modal/Applicants table refresh without waiting for refetch.
      setUploads((prev) => prev.filter((item) => item.id !== id))
      setMessage("Upload record deleted.")
      fetchUploads({ silent: true })
      return true
    } catch (error) {
      setMessage("Error deleting record.")
      return false
    }
  }

  const handleReanalyze = async () => {
    if (!viewItem?.id) return

    try {
      const response = await fetch(`http://localhost:5000/uploads/${viewItem.id}/reanalyze`, {
        method: "PUT"
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.upload) {
        setUploadStatus("fail")
        return
      }

      const updated = payload.upload
      setUploads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setViewItem(updated)
      setUploadStatus("success")
    } catch (error) {
      setUploadStatus("fail")
    }
  }

  const handleViewApplicantFromJobs = (item) => {
    if (!item) return
    setViewItem(item)
    setActionsMenu(null)
    setActivePage("applicants")
  }

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      const defaultDirection = key === "date" || key === "score" ? "desc" : "asc"
      return { key, direction: defaultDirection }
    })
  }

  const filteredUploads = uploads
    .filter((item) => {
      const selectedJob = String(jobFilter || "all").toLowerCase()
      const itemJob = String(item.applied_job_title || item.matched_job_title || "").toLowerCase()
      if (selectedJob !== "all" && itemJob !== selectedJob) {
        return false
      }

      const q = searchTerm.trim().toLowerCase()
      if (!q) return true

      const haystack = `${item.name || ""} ${item.email || ""} ${item.phone || ""} ${item.original_name || ""} ${item.applied_job_title || ""} ${item.matched_job_title || ""} ${item.classification || ""}`.toLowerCase()
      return haystack.includes(q)
    })
    .sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1
      if (sortConfig.key === "name") {
        return (a.name || "").localeCompare(b.name || "") * direction
      }
      if (sortConfig.key === "score") {
        return (Number(a.match_score || 0) - Number(b.match_score || 0)) * direction
      }
      return (new Date(a.uploaded_at) - new Date(b.uploaded_at)) * direction
    })

  const activeJobPosts = jobPosts.filter(
    (job) => String(job.status || "active").toLowerCase() === "active"
  )

  const applicantJobTitles = Array.from(
    new Set(
      uploads
        .map((item) => String(item.applied_job_title || item.matched_job_title || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b))

  const jobFilterOptions = [
    { value: "all", label: "All Jobs" },
    ...applicantJobTitles.map((title) => ({ value: title, label: title }))
  ]
  const appliedJobOptions = [
    { value: "", label: "Select a job post" },
    ...activeJobPosts.map((job) => ({ value: job.title, label: job.title }))
  ]

  const dashboardData = useMemo(() => {
    const normalize = (value) => String(value || "").trim().toLowerCase()

    let highlyQualified = 0
    let moderatelyQualified = 0
    let notQualified = 0

    uploads.forEach((item) => {
      const cls = normalize(item.classification)
      if (cls.includes("not qualified")) {
        notQualified += 1
      } else if (cls.includes("moderately qualified")) {
        moderatelyQualified += 1
      } else if (cls.includes("highly qualified")) {
        highlyQualified += 1
      }
    })

    const recentApplicants = [...uploads]
      .sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0))
      .slice(0, 4)

    const recentJobs = [...jobPosts]
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
      .slice(0, 4)

    return {
      openJobs: jobPosts.filter((job) => String(job.status || "active").toLowerCase() === "active").length,
      totalApplicants: uploads.length,
      highlyQualified,
      moderatelyQualified,
      notQualified,
      recentApplicants,
      recentJobs
    }
  }, [uploads, jobPosts])

  if (!isAuthenticated) {
    return (
      <LoginPage
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        loginError={loginError}
        onSubmit={handleLogin}
      />
    )
  }

  // UI rendering
  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">JACDAS</div>
        <nav className="topnav">
          <button
            type="button"
            className={`topnav-link ${activePage === "dashboard" ? "active" : ""}`}
            onClick={() => handleTopNav("dashboard")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`topnav-link ${activePage === "jobs" ? "active" : ""}`}
            onClick={() => handleTopNav("jobs")}
          >
            Jobs
          </button>
          <button
            type="button"
            className={`topnav-link ${activePage === "applicants" ? "active" : ""}`}
            onClick={() => handleTopNav("applicants")}
          >
            Applicant
          </button>
        </nav>
        <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
      </header>

      {activePage === "applicants" && !viewItem && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="title">Applicants</h2>
              <p className="subtitle">View and manage all job applicants ranked by qualifications</p>
            </div>
            <button className="btn" onClick={openAddApplicantModal}>+ Add Applicant</button>
          </div>

          <div className="filters">
            <input
              className="input"
              type="text"
              placeholder="Search jobs.."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <CustomDropdown
              className="input-dropdown"
              options={jobFilterOptions}
              value={jobFilter}
              onChange={setJobFilter}
              placeholder="All Jobs"
            />
          </div>

          <div className="panel-meta">
            <p>Showing {filteredUploads.length} of {uploads.length} applicants</p>
            <div className="sort-wrap">
              <span>Sort by:</span>
              <button
                className={`sort-btn ${sortConfig.key === "name" ? "active" : ""}`}
                onClick={() => toggleSort("name")}
              >
                Name {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
              </button>
              <button
                className={`sort-btn ${sortConfig.key === "date" ? "active" : ""}`}
                onClick={() => toggleSort("date")}
              >
                Date {sortConfig.key === "date" ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
              </button>
              <button
                className={`sort-btn ${sortConfig.key === "score" ? "active" : ""}`}
                onClick={() => toggleSort("score")}
              >
                Score {sortConfig.key === "score" ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
              </button>
            </div>
          </div>
        </section>
      )}

      {activePage === "applicants" && isUploadModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card modal-modern add-applicant-modal">
            <div className="modal-header">
              <h3>Add New Applicant</h3>
              <button
                type="button"
                className="close-x"
                onClick={() => {
                  setIsUploadModalOpen(false)
                  setName("")
                  setEmail("")
                  setPhone("")
                  setAppliedJobTitle("")
                  setFile(null)
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-grid">
              <div className="field-group">
                <label>Applicant Name</label>
                <input
                  className="input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Last Name, First Name, Middle Initial"
                />
              </div>

              <div className="field-group">
                <label>Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Sample@gmail.com"
                />
              </div>
            </div>

            <div className="field-group">
              <label>Phone</label>
              <div className="phone-input-wrap">
                <span className="phone-prefix">+63</span>
                <input
                  className="input phone-local-input phone-number"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="9..."
                />
              </div>
            </div>

            <div className="field-group">
              <label>Job Post Applied</label>
              <CustomDropdown
                className="input-dropdown"
                options={appliedJobOptions}
                value={appliedJobTitle}
                onChange={setAppliedJobTitle}
                placeholder="Select a job post"
              />
            </div>

            <div className="field-group">
              <label>Upload Resume/CV for Analysis</label>
              <label className={`upload-dropzone ${file ? "has-file" : ""}`} htmlFor="resume-upload-input">
                <input
                  id="resume-upload-input"
                  className="hidden-file-input"
                  type="file"
                  onChange={handleFileChange}
                />
                {!file && <div className="drop-icon">⇪</div>}
                <p className="drop-hint">
                  {file ? file.name : "Click to upload PDF, DOCX or TXT File"}
                </p>
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={handleUpload}>Analyze and Add Applicant</button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsUploadModalOpen(false)
                  setName("")
                  setEmail("")
                  setPhone("")
                  setAppliedJobTitle("")
                  setFile(null)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadStatus && (
        <div className={`toast ${uploadStatus === "success" ? "toast-success" : "toast-fail"}`}>
          {uploadNotice || (uploadStatus === "success" ? "Success" : "Fail")}
        </div>
      )}

      {activePage === "jobs" ? (
        <JobPostingPage
          uploads={uploads}
          isEmployer={isEmployer}
          onViewApplicant={handleViewApplicantFromJobs}
          onDeleteApplicant={handleDelete}
          onJobsChanged={fetchJobPosts}
        />
      ) : activePage === "dashboard" ? (
        <DashboardPage
          dashboardData={dashboardData}
          onViewAllJobs={() => handleTopNav("jobs")}
          onViewAllApplicants={() => handleTopNav("applicants")}
          onViewApplicant={(item) => {
            setViewItem(item)
            setActivePage("applicants")
          }}
        />
      ) : viewItem ? (
        <ApplicantViewPage
          viewItem={viewItem}
          onBack={() => setViewItem(null)}
          onReanalyze={handleReanalyze}
        />
      ) : isLoadingUploads ? (
        <p>Loading uploads...</p>
      ) : filteredUploads.length === 0 ? (
        <section className="empty-state">
          
          <h3>No applicants found</h3>
          <p>Upload resume to analyze and rank candidates.</p>
        </section>
      ) : (
        <div className="table-wrap">
          <table className="records-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Applicant</th>
                <th>Phone</th>
                <th>Matched Job</th>
                <th>Score</th>
                <th>Classification</th>
                <th>Uploaded File</th>
                <th>Uploaded At</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUploads.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="applicant-cell">
                      <strong>{item.name || "(No name)"}</strong>
                      <span>{item.email || "No email"}</span>
                    </div>
                  </td>
                  <td>{item.phone || "No phone"}</td>
                  <td>{item.applied_job_title || item.matched_job_title || "-"}</td>
                  <td>{item.match_score != null ? `${Number(item.match_score).toFixed(2)}%` : "-"}</td>
                  <td>{item.classification || "-"}</td>
                  {/* <td>{item.original_name} ({item.size_bytes} bytes)</td> */}
                  <td>{item.original_name}</td>
                  <td>{new Date(item.uploaded_at).toLocaleString()}</td>
                  <td className="actions-cell actions-col">
                    <button
                      type="button"
                      className="action-btn action-trigger"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (actionsMenu?.item?.id === item.id) {
                          setActionsMenu(null)
                          return
                        }
                        openActionsMenu(e, item)
                      }}
                    >
                      ...
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activePage === "applicants" && actionsMenu && (
        <div
          className="actions-menu actions-menu-floating"
          style={{ top: `${actionsMenu.top}px`, left: `${actionsMenu.left}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="actions-menu-item"
            onClick={() => {
              setViewItem(actionsMenu.item)
              setActionsMenu(null)
            }}
          >
            View
          </button>
          <a
            className="actions-menu-item"
            href={`http://localhost:5000/uploads/${actionsMenu.item.id}/download`}
            onClick={() => setActionsMenu(null)}
          >
            Download
          </a>
          <button
            type="button"
            className="actions-menu-item danger"
            onClick={() => {
              const itemId = actionsMenu.item.id
              setActionsMenu(null)
              handleDelete(itemId)
            }}
          >
            Delete
          </button>
        </div>
      )}

    </main>
  )
}

export default App
