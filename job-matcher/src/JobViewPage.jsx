import { useEffect, useRef, useState } from "react"
import "./JobViewPage.css"

function JobViewPage({ job, onBack, onApply, onRequireResume, jobSeekerProfile, jobSeekerResume, jobSeekerSupporting, jobSeekerId }) {
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [applicantName, setApplicantName] = useState("")
  const [applicantEmail, setApplicantEmail] = useState("")
  const [applicantPhone, setApplicantPhone] = useState("")
  const [applicantAddress, setApplicantAddress] = useState("")
  const [resumeFiles, setResumeFiles] = useState([])
  const [supportingDocs, setSupportingDocs] = useState({
    certificate: null,
    portfolio: null,
    recommendation: null,
    transcript: null,
    others: []
  })
  const [invalidSupportingDetails, setInvalidSupportingDetails] = useState([])
  const [forcedSupportingKey, setForcedSupportingKey] = useState(null)
  const [applyNotice, setApplyNotice] = useState("")
  const [applyGateNotice, setApplyGateNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resumeMatch, setResumeMatch] = useState({
    status: "idle",
    score: null,
    qualifies: false,
    minimumScore: 50,
    message: ""
  })
  const supportingInputRef = useRef(null)
  const resumeInputRef = useRef(null)
  const [showErrors, setShowErrors] = useState(false)
  const [applyTab, setApplyTab] = useState("profile")

  const normalizePhoneInput = (value) => {
    const digitsOnly = String(value || "").replace(/\D/g, "")
    const withoutCountryPrefix = digitsOnly.startsWith("63") ? digitsOnly.slice(2) : digitsOnly
    const withoutLocalPrefix = withoutCountryPrefix.startsWith("0")
      ? withoutCountryPrefix.slice(1)
      : withoutCountryPrefix
    return withoutLocalPrefix.slice(0, 10)
  }

  const resetApplyForm = () => {
    setApplyNotice("")
    setApplicantAddress("")
    setResumeFiles([])
    setInvalidSupportingDetails([])
    setSupportingDocs({
      certificate: null,
      portfolio: null,
      recommendation: null,
      transcript: null,
      others: []
    })
    setIsSubmitting(false)
    setShowErrors(false)
    setApplyTab("profile")
  }

  useEffect(() => {
    if (!applyNotice) return
    const timer = setTimeout(() => {
      setApplyNotice("")
    }, 2400)
    return () => clearTimeout(timer)
  }, [applyNotice])

  useEffect(() => {
    if (!applyGateNotice) return
    const timer = setTimeout(() => {
      setApplyGateNotice("")
    }, 2400)
    return () => clearTimeout(timer)
  }, [applyGateNotice])

  const supportingSteps = [
    { key: "certificate", label: "Certificate", accept: ".pdf,.png,.jpg,.jpeg", multiple: false },
    { key: "portfolio", label: "Portfolio", accept: ".pdf,.png,.jpg,.jpeg", multiple: false },
    { key: "recommendation", label: "Application Letter", accept: ".pdf,.png,.jpg,.jpeg", multiple: false },
    { key: "transcript", label: "Transcript", accept: ".pdf,.png,.jpg,.jpeg", multiple: false },
    { key: "others", label: "Other Supporting Documents", accept: ".pdf,.png,.jpg,.jpeg", multiple: true }
  ]

  const getSupportingStepByKey = (key) => supportingSteps.find((step) => step.key === key) || supportingSteps[0]

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "-"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const handleSupportingFiles = (key, files) => {
    if (!files?.length) return
    setInvalidSupportingDetails([])
    setSupportingDocs((prev) => {
      const next = { ...prev }
      if (key === "others") {
        const existing = Array.isArray(next.others) ? next.others : []
        const merged = [...existing]
        files.forEach((file) => {
          const exists = merged.some(
            (item) =>
              item.name === file.name &&
              item.size === file.size &&
              item.lastModified === file.lastModified
          )
          if (!exists) {
            merged.push(file)
          }
        })
        next.others = merged
      } else {
        next[key] = files[0]
      }
      return next
    })
  }

  const getCurrentSupportingStepIndex = () => {
    for (let i = 0; i < supportingSteps.length; i += 1) {
      const step = supportingSteps[i]
      if (step.key === "others") {
        if (!supportingDocs.others?.length) return i
      } else if (!supportingDocs[step.key]) {
        return i
      }
    }
    return supportingSteps.length - 1
  }

  const currentSupportingStepIndex = getCurrentSupportingStepIndex()
  const currentSupportingStep = supportingSteps[currentSupportingStepIndex]
  const activeSupportingStep = forcedSupportingKey
    ? getSupportingStepByKey(forcedSupportingKey)
    : currentSupportingStep

  const supportingDocumentsComplete = supportingSteps.every((step) => {
    if (step.key === "others") return true
    return Boolean(supportingDocs[step.key])
  })

  const invalidSupportingTypes = Array.from(
    new Set((invalidSupportingDetails || []).map((item) => item?.type).filter(Boolean))
  )

  const typeLabelMap = {
    certificate: "Certificate",
    portfolio: "Portfolio",
    recommendation: "Application Letter",
    transcript: "Transcript",
    others: "Other Supporting Documents",
    other: "Other Supporting Documents"
  }

  useEffect(() => {
    if (!isApplyModalOpen) return
    const profileName = jobSeekerProfile?.fullName || ""
    const profileEmail = jobSeekerProfile?.email || ""
    const profilePhone = normalizePhoneInput(jobSeekerProfile?.phone || "")
    const profileAddress = jobSeekerProfile?.address || jobSeekerProfile?.location || ""
    setApplicantName(profileName)
    setApplicantEmail(profileEmail)
    setApplicantPhone(profilePhone)
    setApplicantAddress(profileAddress)
  }, [isApplyModalOpen, jobSeekerProfile])

  useEffect(() => {
    if (!isApplyModalOpen) return
    if (!jobSeekerId || !jobSeekerResume) return
    const controller = new AbortController()
    const fetchResume = async () => {
      try {
        const response = await fetch(`http://localhost:5000/job-seekers/${jobSeekerId}/resume/download`, {
          signal: controller.signal
        })
        if (!response.ok) {
          return
        }
        const blob = await response.blob()
        const file = new File([blob], jobSeekerResume.name || "resume", {
          type: jobSeekerResume.mimeType || blob.type || "application/octet-stream"
        })
        setResumeFiles([file])
      } catch {
        // Ignore fetch aborts or download errors.
      }
    }
    fetchResume()
    return () => controller.abort()
  }, [isApplyModalOpen, jobSeekerId, jobSeekerResume])

  useEffect(() => {
    if (!isApplyModalOpen) return
    if (!jobSeekerId) return
    const profileSupporting = Array.isArray(jobSeekerSupporting) ? jobSeekerSupporting : []
    if (!profileSupporting.length) return

    const controller = new AbortController()
    const fetchSupporting = async () => {
      const next = {
        certificate: null,
        portfolio: null,
        recommendation: null,
        transcript: null,
        others: []
      }

      for (const item of profileSupporting) {
        const supportId = Number(item?.id)
        if (!supportId) continue
        try {
          const response = await fetch(
            `http://localhost:5000/job-seekers/${jobSeekerId}/supporting/${supportId}/download`,
            { signal: controller.signal }
          )
          if (!response.ok) continue
          const blob = await response.blob()
          const file = new File([blob], item?.originalName || `supporting-${supportId}`, {
            type: item?.mimeType || blob.type || "application/octet-stream"
          })
          const typeKey = String(item?.type || "others").toLowerCase()
          if (typeKey === "others" || typeKey === "other") {
            next.others.push(file)
          } else if (["certificate", "portfolio", "recommendation", "transcript"].includes(typeKey)) {
            next[typeKey] = file
          }
        } catch (error) {
          if (error?.name === "AbortError") {
            return
          }
        }
      }

      setSupportingDocs(next)
    }

    fetchSupporting()
    return () => controller.abort()
  }, [isApplyModalOpen, jobSeekerId, jobSeekerSupporting])

  useEffect(() => {
    if (!job || !jobSeekerId) return
    if (!jobSeekerResume) {
      setResumeMatch({
        status: "missing",
        score: null,
        qualifies: false,
        minimumScore: 50,
        message: "Resume is required."
      })
      return
    }

    let isMounted = true
    const controller = new AbortController()
    setResumeMatch((prev) => ({
      ...prev,
      status: "loading",
      message: ""
    }))

    const fetchMatch = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/job-seekers/${jobSeekerId}/resume/match?jobTitle=${encodeURIComponent(job.title)}`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.message || "Failed to check resume match.")
        }
        const payload = await response.json()
        if (!isMounted) return
        setResumeMatch({
          status: "ready",
          score: payload?.matchScore ?? null,
          qualifies: Boolean(payload?.qualifies),
          minimumScore: payload?.minimumScore ?? 50,
          message: ""
        })
      } catch (error) {
        if (!isMounted || error?.name === "AbortError") return
        setResumeMatch({
          status: "error",
          score: null,
          qualifies: false,
          minimumScore: 50,
          message: error.message || "Failed to check resume match."
        })
      }
    }

    fetchMatch()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [job, jobSeekerId, jobSeekerResume])

  const isApplyDisabled = isSubmitting

  const nameError = !applicantName.trim()
  const emailError = !applicantEmail.trim()
  const phoneMissing = !applicantPhone.trim()
  const phoneLengthInvalid = !phoneMissing && applicantPhone.length !== 10
  const resumeError = resumeFiles.length === 0
  const supportingError = !supportingDocumentsComplete
  const addressError = !applicantAddress.trim()
  const profileComplete = !nameError && !emailError && !phoneMissing && !phoneLengthInvalid && !addressError
  const resumeComplete = !resumeError
  const credentialsComplete = !supportingError
  const resumeMatchLoading = resumeMatch.status === "loading"
  const resumeMatchReady = resumeMatch.status === "ready"
  const resumeMatchQualified = resumeMatchReady && resumeMatch.qualifies
  const resumeMatchError = resumeMatch.status === "error"
  const applyGateDisabled = Boolean(resumeMatchLoading || resumeMatchError)
  const skillItems = (job?.requiredSkills || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  if (!job) {
    return (
      <section className="job-view-page">
        <button type="button" className="job-view-back" onClick={onBack}>← Back</button>
        <p className="muted">Job details not found.</p>
      </section>
    )
  }

  return (
    <section className="job-view-page">
      <div className="job-view-header">
        <button type="button" className="job-view-back" onClick={onBack}>←</button>
        <div className="job-view-header-text">
          <p className="job-view-kicker">Job Opportunity</p>
          <h2>{job.title}</h2>
          <p className="job-view-subtitle">{job.department || "-"} Department</p>
        </div>
        <div className="job-view-header-meta">
          <span className="job-view-chip">{job.type || "Full-time"}</span>
          <span className="job-view-chip chip-outline">{job.location || "Location TBA"}</span>
        </div>
      </div>

      <div className="job-view-card">
        <div className="job-view-card-header">
          <h3>Job Description</h3>
          <div className="job-view-salary">
            <span>{String(job.type || "").toLowerCase().includes("part") ? "Salary Grade & Hourly Rate" : "Salary Grade & Salary per Month"}</span>
            <strong>
              {job.salaryMin != null || job.salaryMax != null
                ? `Grade ${job.salaryMin ?? "0"} · ₱${job.salaryMax ?? "0"}${String(job.type || "").toLowerCase().includes("part") ? " / hour" : " / month"}`
                : "-"}
            </strong>
          </div>
        </div>

        <div className="job-view-info-grid">
          <div className="job-view-info-item">
            <span>Job Position</span>
            <strong>{job.title}</strong>
          </div>
          <div className="job-view-info-item">
            <span>Department</span>
            <strong>{job.department || "-"}</strong>
          </div>
          <div className="job-view-info-item">
            <span>Location</span>
            <strong>{job.location || "-"}</strong>
          </div>
          <div className="job-view-info-item">
            <span>Employment Type</span>
            <strong>{job.type || "-"}</strong>
          </div>
          <div className="job-view-info-item">
            <span>Minimum Education</span>
            <strong>{job.minimumEducation || "-"}</strong>
          </div>
          <div className="job-view-info-item">
            <span>Minimum Experience</span>
            <strong>{job.minimumExperienceYears ?? 0} years</strong>
          </div>
        </div>

        <div className="job-view-section">
          <h4>Role Summary</h4>
          <p>{job.description || "-"}</p>
        </div>

        <div className="job-view-section">
          <h4>Required Skills</h4>
          {skillItems.length ? (
            <div className="job-view-skill-grid">
              {skillItems.map((skill) => (
                <span className="job-view-skill-pill" key={skill}>{skill}</span>
              ))}
            </div>
          ) : (
            <p>-</p>
          )}
        </div>
      </div>

      {String(job.status || "active").toLowerCase() !== "closed" && (
        <div className="job-view-footer">
          {resumeMatchReady && resumeMatchQualified && (
            <button
              type="button"
              className="btn"
              disabled={applyGateDisabled}
              onClick={() => {
                if (!jobSeekerResume) {
                  setApplyGateNotice("Please upload your resume in Profile before applying.")
                  onRequireResume?.()
                  return
                }
                setIsApplyModalOpen(true)
              }}
            >
              Apply
            </button>
          )}
          {!resumeMatchReady && !resumeMatchError && (
            <p className="job-view-apply-notice">
              Checking your resume match...
            </p>
          )}
          {resumeMatchReady && !resumeMatchQualified && (
            <p className="job-view-apply-notice">
              You are not a match for this job based on your resume.
            </p>
          )}
          {resumeMatchError && (
            <p className="job-view-apply-notice">
              {resumeMatch.message || "Unable to verify resume match."}
            </p>
          )}
          {applyGateNotice && (
            <p className="job-view-apply-notice">
              {applyGateNotice}
            </p>
          )}
        </div>
      )}

      {isApplyModalOpen && (
        <div className="modal-overlay" onClick={() => setIsApplyModalOpen(false)}>
          <div className="modal-card modal-modern job-apply-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header apply-header">
              <h3>Add New Applicant for: {job.title}</h3>
              <button
                type="button"
                className="close-x"
                onClick={() => {
                  setIsApplyModalOpen(false)
                  resetApplyForm()
                }}
              >
                ×
              </button>
            </div>

            <div className="apply-tabs">
              <button
                type="button"
                className={`apply-tab ${applyTab === "profile" ? "active" : ""}`}
                onClick={() => {
                  setApplyTab("profile")
                  setShowErrors(false)
                }}
              >
                Profile
              </button>
              <button
                type="button"
                className={`apply-tab ${applyTab === "resume" ? "active" : ""}`}
                disabled={!profileComplete}
                onClick={() => {
                  setApplyTab("resume")
                  setShowErrors(false)
                }}
              >
                Resume/CV
              </button>
              <button
                type="button"
                className={`apply-tab ${applyTab === "credentials" ? "active" : ""}`}
                disabled={!profileComplete || !resumeComplete}
                onClick={() => {
                  setApplyTab("credentials")
                  setShowErrors(false)
                }}
              >
                Credentials
              </button>
            </div>

            {applyTab === "profile" && (
              <div className="apply-panel">
                <div className="modal-grid apply-grid">
                  <div className="field-group">
                    <label>Applicant Name</label>
                    <input
                      className={`input ${showErrors && nameError ? "input-error" : ""}`}
                      type="text"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="Last Name, First Name, Middle Initial"
                    />
                  </div>
                  <div className="field-group">
                    <label>Email</label>
                    <input
                      className={`input ${showErrors && emailError ? "input-error" : ""}`}
                      type="email"
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      placeholder="Sample@gmail.com"
                    />
                  </div>
                </div>

                <div className="modal-grid apply-grid">
                  <div className="field-group">
                    <label>Phone</label>
                    <input
                      className={`input phone-number ${showErrors && (phoneMissing || phoneLengthInvalid) ? "input-error" : ""}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={13}
                      value={`+63${applicantPhone}`}
                      onChange={(e) => setApplicantPhone(normalizePhoneInput(e.target.value))}
                      placeholder="+639XXXXXXXXX"
                    />
                  </div>
                  <div className="field-group">
                    <label>Address</label>
                    <input
                      className={`input ${showErrors && addressError ? "input-error" : ""}`}
                      type="text"
                      value={applicantAddress}
                      onChange={(e) => setApplicantAddress(e.target.value)}
                      placeholder="Brgy, City, Province"
                    />
                  </div>
                </div>
              </div>
            )}

            {applyTab === "resume" && (
              <div className="apply-panel">
                <div className="field-group">
                  <label>Upload Resume/CV</label>
                  <input
                    id="job-apply-upload"
                    ref={resumeInputRef}
                    className="hidden-file-input"
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const selected = Array.from(e.target.files || [])
                      if (!selected.length) return
                      const pdf = selected.find((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
                      if (pdf) {
                        setResumeFiles([pdf])
                      } else {
                        setResumeFiles(selected)
                      }
                      e.target.value = ""
                    }}
                  />
                  <div
                    className={`resume-table-wrap ${showErrors && resumeError && applyTab === "resume" ? "input-error" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => resumeInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        resumeInputRef.current?.click()
                      }
                    }}
                  >
                    <table className="resume-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Document</th>
                          <th>File Type</th>
                          <th>Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumeFiles.length ? (
                          resumeFiles.map((file) => (
                            <tr key={`${file.name}-${file.size}-${file.lastModified}`}>
                              <td>Resume/CV</td>
                              <td>{file.name}</td>
                              <td>{file.type || "Unknown"}</td>
                              <td>{formatFileSize(file.size)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr className="supporting-docs-empty">
                            <td colSpan={4}>No supporting documents added yet.</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4}>
                            <button
                              className="js-outline-btn resume-add-btn"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                resumeInputRef.current?.click()
                              }}
                            >
                              Add Resume/CV
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {applyTab === "credentials" && (
              <div className="apply-panel">
                <div className="field-group">
                  <div className="supporting-docs-header">
                    <div>
                      <label>Supporting Documents</label>
                      <p className="supporting-docs-progress">
                        {supportingDocumentsComplete
                          ? "All required supporting documents completed."
                          : `Step ${currentSupportingStepIndex + 1} of ${supportingSteps.length}: ${currentSupportingStep.label}`}
                      </p>
                    </div>
                  </div>
                  <input
                    id="job-apply-supporting"
                    ref={supportingInputRef}
                    className="hidden-file-input"
                    type="file"
                    multiple={activeSupportingStep?.key === "others" ? true : activeSupportingStep.multiple}
                    accept={activeSupportingStep.accept}
                    onChange={(e) => {
                      const stepKey = forcedSupportingKey || (supportingDocumentsComplete ? "others" : currentSupportingStep.key)
                      handleSupportingFiles(stepKey, Array.from(e.target.files || []))
                      setForcedSupportingKey(null)
                      e.target.value = ""
                    }}
                  />
                  <div className={`supporting-docs-table-wrap ${showErrors && supportingError && applyTab === "credentials" ? "input-error" : ""}`}>
                    <table className="supporting-docs-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Document</th>
                          <th>File Type</th>
                          <th>Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supportingDocumentsComplete ||
                        supportingSteps.some((step) => {
                          if (step.key === "others") return supportingDocs.others?.length
                          return supportingDocs[step.key]
                        }) ? (
                          supportingSteps.flatMap((step) => {
                            if (step.key === "others") {
                              return (supportingDocs.others || []).map((file) => (
                                <tr
                                  key={`${step.key}-${file.name}-${file.size}-${file.lastModified}`}
                                  className={invalidSupportingTypes.includes(step.key) ? "row-error" : ""}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    setForcedSupportingKey(step.key)
                                    supportingInputRef.current?.click()
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault()
                                      setForcedSupportingKey(step.key)
                                      supportingInputRef.current?.click()
                                    }
                                  }}
                                >
                                  <td>{step.label}</td>
                                  <td>{file.name}</td>
                                  <td>{file.type || "Unknown"}</td>
                                  <td>{formatFileSize(file.size)}</td>
                                </tr>
                              ))
                            }
                            const file = supportingDocs[step.key]
                            if (!file) return []
                            return (
                              <tr
                                key={`${step.key}-${file.name}-${file.size}-${file.lastModified}`}
                                className={invalidSupportingTypes.includes(step.key) ? "row-error" : ""}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setForcedSupportingKey(step.key)
                                  supportingInputRef.current?.click()
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    setForcedSupportingKey(step.key)
                                    supportingInputRef.current?.click()
                                  }
                                }}
                              >
                                <td>{step.label}</td>
                                <td>{file.name}</td>
                                <td>{file.type || "Unknown"}</td>
                                <td>{formatFileSize(file.size)}</td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr className="supporting-docs-empty">
                            <td colSpan={4}>No supporting documents added yet.</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4}>
                            <button
                              className="js-outline-btn supporting-docs-add-btn"
                              type="button"
                              onClick={() => supportingInputRef.current?.click()}
                            >
                              {supportingDocumentsComplete ? "Add Other Supporting Documents" : `Add ${currentSupportingStep.label}`}
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {invalidSupportingDetails.length > 0 && (
                    <div className="field-error">
                      {invalidSupportingDetails.map((item) => {
                        const label = typeLabelMap[item?.type] || "Supporting Document"
                        const name = item?.name || "document"
                        return (
                          <div key={`${item.type}-${name}`}>
                            {label} "{name}" does not match the required document type.
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}


            {applyNotice && <div className="toast toast-fail">{applyNotice}</div>}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setIsApplyModalOpen(false)
                  resetApplyForm()
                }}
              >
                Cancel
              </button>
              <button
                className="btn"
                type="button"
                disabled={isApplyDisabled}
                onClick={async () => {
                  const setStepNotice = (message) => {
                    setApplyNotice(message)
                  }
                  const goNext = () => {
                    if (applyTab === "profile") {
                      if (!profileComplete) {
                        setShowErrors(true)
                        setStepNotice("Please complete the profile details before continuing.")
                        return
                      }
                      setShowErrors(false)
                      setApplyTab("resume")
                      return
                    }
                    if (applyTab === "resume") {
                      if (!resumeComplete) {
                        setStepNotice("Please upload your resume to continue.")
                        return
                      }
                      setShowErrors(false)
                      setApplyTab("credentials")
                      return
                    }
                  }

                  if (applyTab !== "credentials") {
                    goNext()
                    return
                  }

                  setApplyNotice("")
                  setShowErrors(true)
                  if (
                    nameError ||
                    emailError ||
                    phoneMissing ||
                    phoneLengthInvalid ||
                    addressError ||
                    resumeError ||
                    supportingError
                  ) {
                    setApplyNotice("Please complete all required fields.")
                    return
                  }
                  if (!resumeMatchQualified) {
                    const score = Number(resumeMatch.score || 0)
                    const minScore = resumeMatch.minimumScore ?? 50
                    setApplyNotice(`Resume match score ${score.toFixed(2)}% is below the required ${minScore}%.`)
                    return
                  }

                  setIsSubmitting(true)
                  const result = await onApply?.({
                    name: applicantName,
                    email: applicantEmail,
                    phone: applicantPhone,
                    file: resumeFiles[0] || null,
                    supportingFiles: supportingSteps.flatMap((step) => {
                      if (step.key === "others") {
                        return supportingDocs.others || []
                      }
                      return supportingDocs[step.key] ? [supportingDocs[step.key]] : []
                    }).concat(resumeFiles.slice(1)),
                    supportingTypes: supportingSteps.flatMap((step) => {
                      if (step.key === "others") {
                        return (supportingDocs.others || []).map(() => step.key)
                      }
                      return supportingDocs[step.key] ? [step.key] : []
                    }).concat(resumeFiles.slice(1).map(() => "other")),
                    address: applicantAddress,
                    appliedJobTitle: job.title,
                  })
                  if (result?.ok) {
                    setIsApplyModalOpen(false)
                    resetApplyForm()
                  } else {
                    if (Array.isArray(result?.invalidSupporting) && result.invalidSupporting.length) {
                      setInvalidSupportingDetails(result.invalidSupporting)
                    } else {
                      setInvalidSupportingDetails([])
                    }
                    setApplyNotice(result?.message || "Failed to submit application.")
                  }
                  setIsSubmitting(false)
                }}
              >
                {isSubmitting ? "Applying..." : applyTab === "credentials" ? "Apply" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default JobViewPage
