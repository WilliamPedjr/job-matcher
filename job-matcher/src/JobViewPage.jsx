import { useEffect, useState } from "react"
import "./JobViewPage.css"

function JobViewPage({ job, onBack, onApply, jobSeekerProfile }) {
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [applicantName, setApplicantName] = useState("")
  const [applicantEmail, setApplicantEmail] = useState("")
  const [applicantPhone, setApplicantPhone] = useState("")
  const [resumeFile, setResumeFile] = useState(null)
  const [applyError, setApplyError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const normalizePhoneInput = (value) => {
    const digitsOnly = String(value || "").replace(/\D/g, "")
    const withoutCountryPrefix = digitsOnly.startsWith("63") ? digitsOnly.slice(2) : digitsOnly
    const withoutLocalPrefix = withoutCountryPrefix.startsWith("0")
      ? withoutCountryPrefix.slice(1)
      : withoutCountryPrefix
    return withoutLocalPrefix.slice(0, 10)
  }

  const resetApplyForm = () => {
    setApplyError("")
    setResumeFile(null)
    setIsSubmitting(false)
  }

  useEffect(() => {
    if (!isApplyModalOpen) return
    const profileName = jobSeekerProfile?.fullName || ""
    const profileEmail = jobSeekerProfile?.email || ""
    const profilePhone = normalizePhoneInput(jobSeekerProfile?.phone || "")
    setApplicantName(profileName)
    setApplicantEmail(profileEmail)
    setApplicantPhone(profilePhone)
  }, [isApplyModalOpen, jobSeekerProfile])
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
                  className="input"
                  type="text"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="Last Name, First Name, Middle Initial"
                />
              </div>
              <div className="field-group">
                <label>Email</label>
                <input
                  className="input"
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
                  className="input phone-local-input phone-number"
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
                className={`upload-dropzone ${resumeFile ? "has-file" : ""}`}
                htmlFor="job-apply-upload"
              >
                <input
                  id="job-apply-upload"
                  className="hidden-file-input"
                  type="file"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                />
                {!resumeFile && <div className="drop-icon">⇪</div>}
                <p className="drop-hint">
                  {resumeFile ? resumeFile.name : "Click to upload PDF, DOCX or TXT File"}
                </p>
              </label>
            </div>


            {applyError && <p className="job-apply-error">{applyError}</p>}

            <div className="modal-actions">
              <button
                className="btn"
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  setApplyError("")
                  if (!applicantName.trim() || !applicantEmail.trim() || !applicantPhone.trim()) {
                    setApplyError("Please fill in all fields.")
                    return
                  }
                  if (applicantPhone.length !== 10) {
                    setApplyError("Phone number must be exactly 10 digits after +63.")
                    return
                  }
                  if (!resumeFile) {
                    setApplyError("Please upload a resume/CV file.")
                    return
                  }

                  setIsSubmitting(true)
                  const result = await onApply?.({
                    name: applicantName,
                    email: applicantEmail,
                    phone: applicantPhone,
                    file: resumeFile,
                    appliedJobTitle: job.title,
                  })
                  if (result?.ok) {
                    setIsApplyModalOpen(false)
                    resetApplyForm()
                  } else {
                    setApplyError(result?.message || "Failed to submit application.")
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
