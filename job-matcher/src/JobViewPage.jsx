import { useEffect, useRef, useState } from "react"
import "./JobViewPage.css"

function JobViewPage({ job, onBack, onApply, jobSeekerProfile, jobSeekerResume, jobSeekerId }) {
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [applicantName, setApplicantName] = useState("")
  const [applicantEmail, setApplicantEmail] = useState("")
  const [applicantPhone, setApplicantPhone] = useState("")
  const [resumeFile, setResumeFile] = useState(null)
  const [supportingDocs, setSupportingDocs] = useState({
    certificate: null,
    portfolio: null,
    recommendation: null,
    transcript: null,
    others: []
  })
  const [applyNotice, setApplyNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supportingInputRef = useRef(null)
  const [showErrors, setShowErrors] = useState(false)

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
    setResumeFile(null)
    setSupportingDocs({
      certificate: null,
      portfolio: null,
      recommendation: null,
      transcript: null,
      others: []
    })
    setIsSubmitting(false)
    setShowErrors(false)
  }

  useEffect(() => {
    if (!applyNotice) return
    const timer = setTimeout(() => {
      setApplyNotice("")
    }, 2400)
    return () => clearTimeout(timer)
  }, [applyNotice])

  const supportingSteps = [
    { key: "certificate", label: "Certificate", accept: ".pdf,.png,.jpg,.jpeg", multiple: false },
    { key: "portfolio", label: "Portfolio", accept: ".pdf,.png,.jpg,.jpeg", multiple: false },
    { key: "recommendation", label: "Recommendation Letter", accept: ".pdf,.png,.jpg,.jpeg", multiple: false },
    { key: "transcript", label: "Transcript", accept: ".pdf,.png,.jpg,.jpeg", multiple: false },
    { key: "others", label: "Other Supporting Documents", accept: ".pdf,.png,.jpg,.jpeg", multiple: true }
  ]

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "-"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const handleSupportingFiles = (key, files) => {
    if (!files?.length) return
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

  const supportingDocumentsComplete = supportingSteps.every((step) => {
    if (step.key === "others") return true
    return Boolean(supportingDocs[step.key])
  })

  useEffect(() => {
    if (!isApplyModalOpen) return
    const profileName = jobSeekerProfile?.fullName || ""
    const profileEmail = jobSeekerProfile?.email || ""
    const profilePhone = normalizePhoneInput(jobSeekerProfile?.phone || "")
    setApplicantName(profileName)
    setApplicantEmail(profileEmail)
    setApplicantPhone(profilePhone)
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
        setResumeFile(file)
      } catch {
        // Ignore fetch aborts or download errors.
      }
    }
    fetchResume()
    return () => controller.abort()
  }, [isApplyModalOpen, jobSeekerId, jobSeekerResume])

  const isApplyDisabled = isSubmitting

  const nameError = !applicantName.trim()
  const emailError = !applicantEmail.trim()
  const phoneMissing = !applicantPhone.trim()
  const phoneLengthInvalid = !phoneMissing && applicantPhone.length !== 10
  const resumeError = !resumeFile
  const supportingError = !supportingDocumentsComplete
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
        <div>
          <h2>{job.title}</h2>
          <p className="job-view-subtitle">{job.department || "-"} Department</p>
        </div>
      </div>

      <div className="job-view-card">
        <h3>Job Description</h3>
        <div className="job-view-content">
          <p><strong>Job Position:</strong> {job.title}</p>
          <p><strong>Department:</strong> {job.department || "-"}</p>
          <p><strong>Location:</strong> {job.location || "-"}</p>
          <p><strong>Employment Type:</strong> {job.type || "-"}</p>

          <div className="job-view-section">
            <strong>Job Description:</strong>
            <p>{job.description || "-"}</p>
          </div>

          <div className="job-view-section">
            <strong>Required Skills:</strong>
            <p>{job.requiredSkills || "-"}</p>
          </div>

          <p><strong>Minimum Education:</strong> {job.minimumEducation || "-"}</p>
          <p><strong>Minimum Experience:</strong> {job.minimumExperienceYears ?? 0} years</p>
          <p>
            <strong>Salary Range:</strong>{" "}
            {job.salaryMin != null || job.salaryMax != null
              ? `₱${job.salaryMin ?? "0"} - ₱${job.salaryMax ?? "0"}`
              : "-"}
          </p>
        </div>
      </div>

      <div className="job-view-footer">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setIsApplyModalOpen(true)
          }}
        >
          Apply
        </button>
      </div>

      {isApplyModalOpen && (
        <div className="modal-overlay" onClick={() => setIsApplyModalOpen(false)}>
          <div className="modal-card modal-modern job-apply-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Application Form – {job.title}</h3>
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

            <div className="modal-grid">
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

            <div className="field-group">
              <label>Phone</label>
              <div className="phone-input-wrap">
                <span className="phone-prefix">+63</span>
                <input
                  className={`input phone-local-input phone-number ${showErrors && (phoneMissing || phoneLengthInvalid) ? "input-error" : ""}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(normalizePhoneInput(e.target.value))}
                  placeholder="9..."
                />
              </div>
            </div>

            <div className="field-group">
              <label>Upload Resume/CV</label>
              <label
                className={`upload-dropzone ${resumeFile ? "has-file" : ""} ${showErrors && resumeError ? "input-error" : ""}`}
                htmlFor="job-apply-upload"
              >
                <input
                  id="job-apply-upload"
                  className="hidden-file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                />
                {!resumeFile && <div className="drop-icon">⇪</div>}
                <p className="drop-hint">
                  {resumeFile ? resumeFile.name : "Click to upload PDF or Image File"}
                </p>
              </label>
            </div>

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
                multiple={supportingDocumentsComplete ? true : currentSupportingStep.multiple}
                accept={currentSupportingStep.accept}
                onChange={(e) => {
                  const stepKey = supportingDocumentsComplete ? "others" : currentSupportingStep.key
                  handleSupportingFiles(stepKey, Array.from(e.target.files || []))
                  e.target.value = ""
                }}
              />
              <div className={`supporting-docs-table-wrap ${showErrors && supportingError ? "input-error" : ""}`}>
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
                            <tr key={`${step.key}-${file.name}-${file.size}-${file.lastModified}`}>
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
                          <tr key={`${step.key}-${file.name}-${file.size}-${file.lastModified}`}>
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
            </div>


            {applyNotice && <div className="toast toast-fail">{applyNotice}</div>}

            <div className="modal-actions">
              <button
                className="btn"
                type="button"
                disabled={isApplyDisabled}
                onClick={async () => {
                  setApplyNotice("")
                  setShowErrors(true)
                  if (nameError || emailError || phoneMissing || phoneLengthInvalid || resumeError || supportingError) {
                    setApplyNotice("Please complete all required fields.")
                    return
                  }

                  setIsSubmitting(true)
                  const result = await onApply?.({
                    name: applicantName,
                    email: applicantEmail,
                    phone: applicantPhone,
                    file: resumeFile,
                    supportingFiles: supportingSteps.flatMap((step) => {
                      if (step.key === "others") {
                        return supportingDocs.others || []
                      }
                      return supportingDocs[step.key] ? [supportingDocs[step.key]] : []
                    }),
                    appliedJobTitle: job.title,
                  })
                  if (result?.ok) {
                    setIsApplyModalOpen(false)
                    resetApplyForm()
                  } else {
                    setApplyNotice(result?.message || "Failed to submit application.")
                  }
                  setIsSubmitting(false)
                }}
              >
                {isSubmitting ? "Applying..." : "Apply"}
              </button>
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
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default JobViewPage
