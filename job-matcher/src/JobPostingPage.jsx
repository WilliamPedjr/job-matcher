import { useEffect, useMemo, useRef, useState } from 'react'
import './JobPostingPage.css'
import CustomDropdown from './CustomDropdown'

function JobPostingPage({ uploads = [], isEmployer = false, isJobSeeker = false, onViewApplicant, onDeleteApplicant, onJobsChanged, onViewJob }) {
  const [jobs, setJobs] = useState([])
  const [templates, setTemplates] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedJobTitle, setSelectedJobTitle] = useState("")
  const [modalSortConfig, setModalSortConfig] = useState({ key: "date", direction: "desc" })
  const [actionsJobId, setActionsJobId] = useState(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingJobId, setEditingJobId] = useState(null)
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newJobDescription, setNewJobDescription] = useState("")
  const [newJobDepartment, setNewJobDepartment] = useState("Information Technology")
  const defaultJobLocation = "Leyte Normal University"
  const [newJobType, setNewJobType] = useState("Full-time")
  const [newJobStatus, setNewJobStatus] = useState("active")
  const [newRequiredSkills, setNewRequiredSkills] = useState("")
  const [newMinimumEducation, setNewMinimumEducation] = useState("")
  const [newMinimumExperienceYears, setNewMinimumExperienceYears] = useState("0")
  const [newSalaryMin, setNewSalaryMin] = useState("")
  const [newSalaryMax, setNewSalaryMax] = useState("")
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [createJobStatus, setCreateJobStatus] = useState("")
  const [createJobNotice, setCreateJobNotice] = useState("")
  const [isJobTitleOpen, setIsJobTitleOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState(null)
  const isEditingJob = editingJobId != null
  const descriptionRef = useRef(null)

  useEffect(() => {
    if (!createJobStatus) return
    const timer = setTimeout(() => {
      setCreateJobStatus("")
      setCreateJobNotice("")
    }, 2600)
    return () => clearTimeout(timer)
  }, [createJobStatus])

  useEffect(() => {
    if (!descriptionRef.current) return
    descriptionRef.current.style.height = "auto"
    descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`
  }, [newJobDescription, isCreateModalOpen])

  const showCreateJobNotice = (status, notice) => {
    setCreateJobStatus(status)
    setCreateJobNotice(notice)
  }

  const fetchJobs = async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true)
    }
    setError("")
    try {
      const response = await fetch("http://localhost:5000/jobs")
      if (!response.ok) {
        throw new Error("Failed to load jobs.")
      }
      const data = await response.json()
      setJobs(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || "Could not fetch job postings.")
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch("http://localhost:5000/job-templates")
      if (!response.ok) {
        throw new Error("Failed to load templates.")
      }
      const data = await response.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch {
      setTemplates([])
    }
  }

  useEffect(() => {
    fetchJobs()
    fetchTemplates()
  }, [])

  useEffect(() => {
    if (actionsJobId == null) return
    const onDocClick = () => setActionsJobId(null)
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [actionsJobId])

  useEffect(() => {
    const onDocClick = () => setIsJobTitleOpen(false)
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [])

  useEffect(() => {
    if (isJobSeeker && isCreateModalOpen) {
      setIsCreateModalOpen(false)
    }
  }, [isJobSeeker, isCreateModalOpen])

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const query = searchTerm.trim().toLowerCase()
      const status = String(job.status || "active").toLowerCase()

      const matchesStatus = statusFilter === "all" ? true : status === statusFilter
      if (!matchesStatus) return false

      if (!query) return true
      const haystack = `${job.title || ""} ${job.description || ""} ${job.department || ""} ${job.location || ""}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [jobs, searchTerm, statusFilter])

  const jobTitleSuggestions = useMemo(() => {
    const titles = [
      ...jobs.map((job) => String(job.title || "").trim()),
      ...templates.map((template) => String(template.title || "").trim())
    ]
    return Array.from(new Set(titles.filter(Boolean)))
  }, [jobs, templates])

  const searchSuggestions = useMemo(() => {
    const tokens = [
      ...jobs.map((job) => String(job.title || "").trim()),
      ...jobs.map((job) => String(job.department || "").trim()),
      ...jobs.map((job) => String(job.location || "").trim())
    ].filter(Boolean)
    return Array.from(new Set(tokens))
  }, [jobs])

  const filteredSearchSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return searchSuggestions.slice(0, 8)
    return searchSuggestions
      .filter((token) => token.toLowerCase().includes(query))
      .slice(0, 8)
  }, [searchSuggestions, searchTerm])

  const filteredJobTitleSuggestions = useMemo(() => {
    const query = newJobTitle.trim().toLowerCase()
    if (!query) return jobTitleSuggestions.slice(0, 8)
    return jobTitleSuggestions
      .filter((title) => title.toLowerCase().includes(query))
      .slice(0, 8)
  }, [jobTitleSuggestions, newJobTitle])

  const templateByTitle = useMemo(() => {
    const map = new Map()
    const sources = [
      ...templates.map((item) => ({ ...item, source: "template" })),
      ...jobs.map((item) => ({ ...item, source: "job" }))
    ]
    sources.forEach((item) => {
      const title = String(item.title || "").trim()
      if (!title) return
      const key = title.toLowerCase()
      if (map.has(key)) return
      map.set(key, item)
    })
    return map
  }, [templates, jobs])

  const applyTemplate = (templateId) => {
    const selected = templates.find((item) => String(item.id) === String(templateId))
    if (!selected) return
    setNewJobDescription(selected.description || "")
    setNewJobDepartment(selected.department || "Information Technology")
    setNewJobType(selected.type || "Full-time")
    setNewRequiredSkills(selected.requiredSkills || "")
    setNewMinimumEducation(selected.minimumEducation || "")
    setNewMinimumExperienceYears(String(selected.minimumExperienceYears ?? 0))
    setNewSalaryMin(selected.salaryMin != null ? String(selected.salaryMin) : "")
    setNewSalaryMax(selected.salaryMax != null ? String(selected.salaryMax) : "")
  }

  const applyTemplateFromRecord = (record) => {
    if (!record) return
    setNewJobDescription(record.description || "")
    setNewJobDepartment(record.department || "Information Technology")
    setNewJobType(record.type || "Full-time")
    setNewRequiredSkills(record.requiredSkills || "")
    setNewMinimumEducation(record.minimumEducation || "")
    setNewMinimumExperienceYears(String(record.minimumExperienceYears ?? 0))
    setNewSalaryMin(record.salaryMin != null ? String(record.salaryMin) : "")
    setNewSalaryMax(record.salaryMax != null ? String(record.salaryMax) : "")
  }

  useEffect(() => {
    const key = newJobTitle.trim().toLowerCase()
    if (!key) return
    if (isEditingJob) return
    const matched = templateByTitle.get(key)
    if (!matched) return
    if (matched.source === "template") {
      applyTemplate(matched.id)
      return
    }
    applyTemplateFromRecord(matched)
  }, [newJobTitle, templateByTitle])

  const selectedJobApplicants = useMemo(() => {
    if (!selectedJobTitle) return []
    return uploads
      .filter((item) => {
        const applied = String(item.applied_job_title || "").toLowerCase()
        const matched = String(item.matched_job_title || "").toLowerCase()
        return applied === selectedJobTitle.toLowerCase() || matched === selectedJobTitle.toLowerCase()
      })
  }, [uploads, selectedJobTitle])

  const sortedSelectedJobApplicants = useMemo(() => {
    const direction = modalSortConfig.direction === "asc" ? 1 : -1
    return [...selectedJobApplicants].sort((a, b) => {
      if (modalSortConfig.key === "name") {
        return (String(a.name || "").localeCompare(String(b.name || ""))) * direction
      }
      if (modalSortConfig.key === "score") {
        return (Number(a.match_score || 0) - Number(b.match_score || 0)) * direction
      }
      return (new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0)) * direction
    })
  }, [selectedJobApplicants, modalSortConfig])

  const toggleModalSort = (key) => {
    setModalSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      const defaultDirection = key === "date" || key === "score" ? "desc" : "asc"
      return { key, direction: defaultDirection }
    })
  }

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "active", label: "Active" },
    { value: "closed", label: "Closed" }
  ]

  const updateJobStatus = async (jobId, status) => {
    try {
      const response = await fetch(`http://localhost:5000/jobs/${jobId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      })
      if (!response.ok) {
        throw new Error("Failed to update status.")
      }
      setActionsJobId(null)
      await fetchJobs({ silent: true })
      await onJobsChanged?.()
    } catch (err) {
      setError(err.message || "Failed to update job status.")
    }
  }

  const performDeleteJobPost = async (jobId) => {
    try {
      const response = await fetch(`http://localhost:5000/jobs/${jobId}`, {
        method: "DELETE"
      })
      if (!response.ok) {
        throw new Error("Failed to delete job post.")
      }
      setActionsJobId(null)
      await fetchJobs({ silent: true })
      await onJobsChanged?.()
    } catch (err) {
      setError(err.message || "Failed to delete job post.")
    }
  }

  const deleteJobPost = (jobId) => {
    setActionsJobId(null)
    setConfirmDeleteJobId(jobId)
  }

  const handleDeleteApplicantInJobModal = async (applicantId) => {
    const deleted = await onDeleteApplicant?.(applicantId, "applicant")
    if (!deleted) return
    await fetchJobs({ silent: true })
    await onJobsChanged?.()
  }

  const handleApplyJob = (job) => {
    if (!job) return
    alert(`Application submitted for ${job.title}.`)
  }

  const resetJobForm = () => {
    setNewJobTitle("")
    setNewJobDescription("")
    setNewJobDepartment("Information Technology")
    setNewJobType("Full-time")
    setNewJobStatus("active")
    setNewRequiredSkills("")
    setNewMinimumEducation("")
    setNewMinimumExperienceYears("0")
    setNewSalaryMin("")
    setNewSalaryMax("")
  }

  const openEditJobModal = (job) => {
    if (!job?.id) return
    setEditingJobId(job.id)
    setNewJobTitle(job.title || "")
    setNewJobDescription(job.description || "")
    setNewJobDepartment(job.department || "Information Technology")
    setNewJobType(job.type || "Full-time")
    setNewJobStatus(job.status || "active")
    setNewRequiredSkills(job.requiredSkills || "")
    setNewMinimumEducation(job.minimumEducation || "")
    setNewMinimumExperienceYears(String(job.minimumExperienceYears ?? 0))
    setNewSalaryMin(job.salaryMin != null ? String(job.salaryMin) : "")
    setNewSalaryMax(job.salaryMax != null ? String(job.salaryMax) : "")
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setEditingJobId(null)
  }

  const createJobPost = async () => {
    const hasMissingField = (
      !newJobTitle.trim() ||
      !newJobDescription.trim() ||
      !newJobDepartment.trim() ||
      !newJobType.trim() ||
      !newJobStatus.trim() ||
      !newRequiredSkills.trim() ||
      !newMinimumEducation.trim() ||
      newMinimumExperienceYears === "" ||
      newSalaryMin === "" ||
      newSalaryMax === ""
    )

    if (hasMissingField) {
      showCreateJobNotice("fail", "Please fill in all fields before creating the job post.")
      return
    }

    const minExp = Number(newMinimumExperienceYears)
    const salaryMin = Number(newSalaryMin)
    const salaryMax = Number(newSalaryMax)

    if (Number.isNaN(minExp) || minExp < 0) {
      showCreateJobNotice("fail", "Minimum experience must be a valid non-negative number.")
      return
    }

    if (Number.isNaN(salaryMin) || Number.isNaN(salaryMax) || salaryMin < 0 || salaryMax < 0) {
      showCreateJobNotice("fail", "Salary range must be valid non-negative numbers.")
      return
    }

    if (salaryMax < salaryMin) {
      showCreateJobNotice("fail", "Salary Range (Max) must be greater than or equal to Salary Range (Min).")
      return
    }

    setIsCreatingJob(true)
    setError("")
    try {
      const response = await fetch("http://localhost:5000/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newJobTitle.trim(),
          description: newJobDescription.trim(),
          department: newJobDepartment.trim(),
          location: defaultJobLocation,
          type: newJobType.trim(),
          status: newJobStatus,
          requiredSkills: newRequiredSkills.trim(),
          minimumEducation: newMinimumEducation,
          minimumExperienceYears: minExp,
          salaryMin,
          salaryMax
        })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Failed to create job post.")
      }

      closeCreateModal()
      resetJobForm()
      showCreateJobNotice("success", "Job post created successfully.")
      await fetchJobs()
      await onJobsChanged?.()
    } catch (err) {
      showCreateJobNotice("fail", err.message || "Failed to create job post.")
    } finally {
      setIsCreatingJob(false)
    }
  }

  const updateJobPost = async () => {
    if (!editingJobId) return
    const hasMissingField = (
      !newJobTitle.trim() ||
      !newJobDescription.trim() ||
      !newJobDepartment.trim() ||
      !newJobType.trim() ||
      !newJobStatus.trim() ||
      !newRequiredSkills.trim() ||
      !newMinimumEducation.trim() ||
      newMinimumExperienceYears === "" ||
      newSalaryMin === "" ||
      newSalaryMax === ""
    )

    if (hasMissingField) {
      showCreateJobNotice("fail", "Please fill in all fields before saving changes.")
      return
    }

    const minExp = Number(newMinimumExperienceYears)
    const salaryMin = Number(newSalaryMin)
    const salaryMax = Number(newSalaryMax)

    if (Number.isNaN(minExp) || minExp < 0) {
      showCreateJobNotice("fail", "Minimum experience must be a valid non-negative number.")
      return
    }

    if (Number.isNaN(salaryMin) || Number.isNaN(salaryMax) || salaryMin < 0 || salaryMax < 0) {
      showCreateJobNotice("fail", "Salary range must be valid non-negative numbers.")
      return
    }

    if (salaryMax < salaryMin) {
      showCreateJobNotice("fail", "Salary Range (Max) must be greater than or equal to Salary Range (Min).")
      return
    }

    setIsCreatingJob(true)
    setError("")
    try {
      const response = await fetch(`http://localhost:5000/jobs/${editingJobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newJobTitle.trim(),
          description: newJobDescription.trim(),
          department: newJobDepartment.trim(),
          location: defaultJobLocation,
          type: newJobType.trim(),
          status: newJobStatus,
          requiredSkills: newRequiredSkills.trim(),
          minimumEducation: newMinimumEducation,
          minimumExperienceYears: minExp,
          salaryMin,
          salaryMax
        })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Failed to update job post.")
      }

      closeCreateModal()
      resetJobForm()
      showCreateJobNotice("success", "Job post updated successfully.")
      await fetchJobs()
      await onJobsChanged?.()
    } catch (err) {
      showCreateJobNotice("fail", err.message || "Failed to update job post.")
    } finally {
      setIsCreatingJob(false)
    }
  }

  return (
    <section className="jobs-panel jobs-panel-modern">
      <div className="jobs-hero">
        <div>
          <p className="jobs-kicker">Job Posting</p>
          <h1 className="jobs-title">New Jobs</h1>
          <p className="jobs-subtitle">Overview of Job List and Requirements</p>
        </div>
        {!isJobSeeker && (
          <button
            type="button"
            className="btn jobs-create-btn"
            onClick={() => {
              if (isJobSeeker) return
              setEditingJobId(null)
              setIsCreateModalOpen(true)
            }}
          >
            + Create Job
          </button>
        )}
      </div>

      <div className="jobs-controls jobs-controls-modern">
        <div className="autocomplete jobs-search">
          <input
            className="input"
            type="text"
            placeholder="Search jobs.."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsSearchOpen(true)
            }}
            onFocus={() => setIsSearchOpen(true)}
            onBlur={() => setTimeout(() => setIsSearchOpen(false), 0)}
          />
          {isSearchOpen && filteredSearchSuggestions.length > 0 && (
            <div className="autocomplete-menu">
              {filteredSearchSuggestions.map((token) => (
                <button
                  key={`job-search-${token}`}
                  type="button"
                  className="autocomplete-item"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setSearchTerm(token)
                    setIsSearchOpen(false)
                  }}
                >
                  {token}
                </button>
              ))}
            </div>
          )}
        </div>
        <CustomDropdown
          className="jobs-filter"
          options={statusOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All Status"
        />
      </div>

      <div className="jobs-grid">
        {isLoading ? (
          <p className="muted">Loading jobs...</p>
        ) : error ? (
          <p className="muted">{error}</p>
        ) : filteredJobs.length === 0 ? (
          <p className="muted">No jobs found.</p>
        ) : (
          filteredJobs.map((job) => (
            <article key={job.id ?? `template-${job.title}`} className="job-card job-card-modern">
              <div className="job-card-head">
                <div>
                  {isJobSeeker ? (
                    <button
                      type="button"
                      className="job-title-link"
                      onClick={() => onViewJob?.(job)}
                    >
                      {job.title}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="job-title-link"
                      onClick={() => openEditJobModal(job)}
                    >
                      {job.title}
                    </button>
                  )}
                  <p className="job-card-dept">{job.department || "-"}</p>
                </div>
                <div className="job-card-actions">
                  <span className={`job-status ${String(job.status || "active").toLowerCase()}`}>
                    {String(job.status || "active").toLowerCase()}
                  </span>
                  {job.id != null && (
                    <>
                      <button
                        className="job-more"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActionsJobId((prev) => (prev === job.id ? null : job.id))
                        }}
                      >
                        ...
                      </button>
                      {actionsJobId === job.id && (
                        <div className="job-actions-menu" onClick={(e) => e.stopPropagation()}>
                          {isJobSeeker ? (
                            <button
                              type="button"
                              className="actions-menu-item"
                              onClick={() => {
                                setActionsJobId(null)
                                onViewJob?.(job)
                              }}
                            >
                              View Details
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="actions-menu-item"
                                onClick={() => {
                                  setActionsJobId(null)
                                  openEditJobModal(job)
                                }}
                              >
                                Edit Details
                              </button>
                              <button
                                type="button"
                                className="actions-menu-item"
                                onClick={() => updateJobStatus(job.id, "active")}
                              >
                                Set Active
                              </button>
                              <button
                                type="button"
                                className="actions-menu-item"
                                onClick={() => updateJobStatus(job.id, "closed")}
                              >
                                Set Closed
                              </button>
                              <button
                                type="button"
                                className="actions-menu-item danger"
                                onClick={() => deleteJobPost(job.id)}
                              >
                                Delete Post
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="job-card-chips">
                <span className="job-chip">{job.location || "-"}</span>
                <span className="job-chip chip-outline">{job.type || "-"}</span>
                {job.source === "template" && <span className="job-chip chip-muted">template</span>}
              </div>

              <p className="job-description">{job.description}</p>

              {!isJobSeeker && (
                <button
                  className="job-applicants job-applicants-bottom"
                  type="button"
                  onClick={() => {
                    setSelectedJobTitle(job.title)
                  }}
                >
                  {Number(job.applicants || 0)} Applicants
                </button>
              )}
            </article>
          ))
        )}
      </div>

      {selectedJobTitle && !isJobSeeker && (
        <div className="modal-overlay" onClick={() => setSelectedJobTitle("")}>
          <div className="modal-card modal-modern job-applicants-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Applicants for {selectedJobTitle}</h3>
              <button type="button" className="close-x" onClick={() => setSelectedJobTitle("")}>×</button>
            </div>

            {selectedJobApplicants.length === 0 ? (
              <p className="muted">No analyzed applicants found for this job.</p>
            ) : (
              <div>
                <div className="panel-meta">
                  <p>Showing {sortedSelectedJobApplicants.length} applicants</p>
                  <div className="sort-wrap">
                    <span>Sort by:</span>
                    <button
                      className={`sort-btn ${modalSortConfig.key === "name" ? "active" : ""}`}
                      onClick={() => toggleModalSort("name")}
                    >
                      Name {modalSortConfig.key === "name" ? (modalSortConfig.direction === "asc" ? "↑" : "↓") : ""}
                    </button>
                    <button
                      className={`sort-btn ${modalSortConfig.key === "date" ? "active" : ""}`}
                      onClick={() => toggleModalSort("date")}
                    >
                      Date {modalSortConfig.key === "date" ? (modalSortConfig.direction === "asc" ? "↑" : "↓") : ""}
                    </button>
                    <button
                      className={`sort-btn ${modalSortConfig.key === "score" ? "active" : ""}`}
                      onClick={() => toggleModalSort("score")}
                    >
                      Score {modalSortConfig.key === "score" ? (modalSortConfig.direction === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="records-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Applicant</th>
                        <th>Phone</th>
                        <th>Score</th>
                        <th>Classification</th>
                        <th>Uploaded File</th>
                        <th>Uploaded At</th>
                        <th className="actions-col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSelectedJobApplicants.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>
                            <div className="applicant-cell">
                              <strong>{item.name || "(No name)"}</strong>
                              <span>{item.email || "No email"}</span>
                            </div>
                          </td>
                          <td>{item.phone || "No phone"}</td>
                          <td>{item.match_score != null ? `${Number(item.match_score).toFixed(2)}%` : "-"}</td>
                          <td>{item.classification || "-"}</td>
                          <td>{item.original_name || "-"}</td>
                          <td>{item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : "-"}</td>
                          <td className="actions-cell actions-col">
                            <div className="job-applicant-actions">
                              <button
                                type="button"
                                className="action-btn action-trigger"
                                onClick={() => {
                                  setSelectedJobTitle("")
                                  onViewApplicant?.(item)
                                }}
                              >
                                View
                              </button>
                              <a
                                className="action-btn action-download"
                                href={`http://localhost:5000/uploads/${item.id}/download`}
                              >
                                Download
                              </a>
                              <button
                                type="button"
                                className="action-btn action-delete"
                                onClick={() => handleDeleteApplicantInJobModal(item.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDeleteJobId != null && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmDeleteJobId(null)
            }
          }}
        >
          <div className="modal-card">
            <h3>Delete Job Post</h3>
            <p>Are you sure you want to delete this job post? This action cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDeleteJobId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  const idToDelete = confirmDeleteJobId
                  setConfirmDeleteJobId(null)
                  if (idToDelete != null) {
                    await performDeleteJobPost(idToDelete)
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && !isJobSeeker && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="modal-card modal-modern create-job-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header create-job-header">
              <div>
                <h3>{isEditingJob ? "Edit Job Details" : "Job Details"}</h3>
                <p className="create-job-subtitle">Basic information about the position</p>
              </div>
              <button type="button" className="close-x" onClick={closeCreateModal}>×</button>
            </div>

            <div className="create-job-layout">
              <div className="create-job-left">
                <section className="create-job-panel">
                  <div className="create-job-panel-head">
                    <div>
                      <h4>Role Overview</h4>
                      <p>Define the core details for this opening.</p>
                    </div>
                    <span className="create-job-chip">Required</span>
                  </div>

                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Job Title</label>
                      <div
                        className="autocomplete"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          className="input"
                          type="text"
                          value={newJobTitle}
                          onChange={(e) => {
                            setNewJobTitle(e.target.value)
                            setIsJobTitleOpen(true)
                          }}
                          onFocus={() => setIsJobTitleOpen(true)}
                          onBlur={() => {
                            setTimeout(() => setIsJobTitleOpen(false), 0)
                          }}
                          placeholder="e.g., Senior Software Engineer"
                        />
                        {isJobTitleOpen && filteredJobTitleSuggestions.length > 0 && (
                          <div className="autocomplete-menu">
                            {filteredJobTitleSuggestions.map((title) => (
                              <button
                                key={`job-title-${title}`}
                                type="button"
                                className="autocomplete-item"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  setNewJobTitle(title)
                                  setIsJobTitleOpen(false)
                                }}
                              >
                                {title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="field-group">
                      <label>Department</label>
                      <input
                        className="input"
                        type="text"
                        value={newJobDepartment}
                        onChange={(e) => setNewJobDepartment(e.target.value)}
                        placeholder="e.g., Engineering"
                      />
                    </div>
                  </div>

                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Employment Type</label>
                      <CustomDropdown
                        className="input-dropdown"
                        options={[
                          { value: "Full-time", label: "Full-time" },
                          { value: "Part-time", label: "Part-time" },
                          { value: "Contract", label: "Contract" },
                          { value: "Internship", label: "Internship" }
                        ]}
                        value={newJobType}
                        onChange={setNewJobType}
                        placeholder="Full-time"
                      />
                    </div>

                    <div className="field-group">
                      <label>Location</label>
                      <input
                        className="input"
                        type="text"
                        value={defaultJobLocation}
                        disabled
                      />
                    </div>
                  </div>

                  <div className="field-group create-job-status-wrap">
                    <label>Status</label>
                    <CustomDropdown
                      className="input-dropdown create-job-status"
                      options={[
                        { value: "active", label: "Active" },
                        { value: "closed", label: "Closed" }
                      ]}
                      value={newJobStatus}
                      onChange={setNewJobStatus}
                      placeholder="Active"
                    />
                  </div>
                </section>

                <section className="create-job-panel">
                  <div className="create-job-panel-head">
                    <div>
                      <h4>Role Description</h4>
                      <p>What should applicants know about the role?</p>
                    </div>
                  </div>
                  <div className="field-group">
                    <label>Description</label>
                    <textarea
                      className="input create-job-description"
                      rows={4}
                      ref={descriptionRef}
                      value={newJobDescription}
                      onChange={(e) => setNewJobDescription(e.target.value)}
                      placeholder="Describe the role, responsibilities and what you're looking for...."
                    />
                  </div>
                </section>

                <section className="create-job-panel">
                  <div className="create-job-panel-head">
                    <div>
                      <h4>Requirements</h4>
                      <p>Define qualifications for applicant matching.</p>
                    </div>
                  </div>

                  <div className="field-group">
                    <label>Required Skills</label>
                    <input
                      className="input"
                      type="text"
                      value={newRequiredSkills}
                      onChange={(e) => setNewRequiredSkills(e.target.value)}
                      placeholder="Add a skill (e.g., Python, React, Project Management)"
                    />
                  </div>

                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Minimum Education</label>
                      <CustomDropdown
                        className="input-dropdown"
                        options={[
                          { value: "", label: "Select education level" },
                          { value: "High School", label: "High School" },
                          { value: "Associate Degree", label: "Associate Degree" },
                          { value: "Bachelor's Degree", label: "Bachelor's Degree" },
                          { value: "Master's Degree", label: "Master's Degree" },
                          { value: "Doctorate", label: "Doctorate" }
                        ]}
                        value={newMinimumEducation}
                        onChange={setNewMinimumEducation}
                        placeholder="Select education level"
                      />
                    </div>

                    <div className="field-group">
                      <label>Minimum Experience (Years)</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={newMinimumExperienceYears}
                        onChange={(e) => setNewMinimumExperienceYears(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Salary Range (Min)</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={newSalaryMin}
                        onChange={(e) => setNewSalaryMin(e.target.value)}
                        placeholder="e.g., 80000"
                      />
                    </div>

                    <div className="field-group">
                      <label>Salary Range (Max)</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={newSalaryMax}
                        onChange={(e) => setNewSalaryMax(e.target.value)}
                        placeholder="e.g., 120000"
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={isEditingJob ? updateJobPost : createJobPost} disabled={isCreatingJob}>
                {isCreatingJob ? (isEditingJob ? "Saving..." : "Creating...") : (isEditingJob ? "Save Changes" : "Create Job")}
              </button>
              <button className="btn btn-secondary" onClick={closeCreateModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {createJobStatus && (
        <div className={`toast ${createJobStatus === "success" ? "toast-success" : "toast-fail"}`}>
          {createJobNotice || (createJobStatus === "success" ? "Success" : "Fail")}
        </div>
      )}
    </section>
  )
}

export default JobPostingPage
