import React from 'react'
import { useEffect, useMemo, useRef, useState } from "react"
import "../styles/ProfilePage.css"
import profileIcon from "../assets/circle-user-solid-full.svg"

const readJsonResponse = async (response) => {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return response.json()
  }

  const text = await response.text().catch(() => "")
  const looksLikeHtml = /^\s*</.test(text)
  throw new Error(
    looksLikeHtml
      ? "The API returned an HTML page instead of JSON. Check that Laravel is running and open the app through http://127.0.0.1:8000 or use the Vite API proxy."
      : "The API returned an invalid response."
  )
}

function ProfilePage({
  userRole,
  loginEmail,
  currentUser,
  onCurrentUserUpdate,
  jobSeekerProfile,
  jobSeekerId,
  onJobSeekerProfileUpdate,
  jobSeekerResume,
  onJobSeekerResumeUpdate,
  jobSeekerSupporting,
  onJobSeekerSupportingUpdate,
  resumeAttention,
  onResumeAttentionConsumed
}) {
  const roleLabel = userRole === "admin"
    ? "Administrator"
    : userRole === "jobseeker"
      ? "Job Seeker"
      : "Employer"
  const isJobSeeker = userRole === "jobseeker"
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [profileError, setProfileError] = useState("")
  const [editMode, setEditMode] = useState(null)
  const [formState, setFormState] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    status: "",
    address: "",
    aboutText: "",
    password: "",
    confirmPassword: "",
    school: "",
    program: "",
    year: "",
    title: "",
    company: ""
  })
  const [editingItem, setEditingItem] = useState(null)
  const [saveStatus, setSaveStatus] = useState("")
  const [invalidFields, setInvalidFields] = useState([])
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({
    linkedInUrl: "",
    email: "",
    phone: ""
  })
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [resumeStatus, setResumeStatus] = useState("")
  const [supportingStatus, setSupportingStatus] = useState("")
  const [supportingErrorToast, setSupportingErrorToast] = useState("")
  const [pendingSupportingType, setPendingSupportingType] = useState("certificate")
  const [isEligibilityModalOpen, setIsEligibilityModalOpen] = useState(false)
  const [eligibilityStatus, setEligibilityStatus] = useState("")
  const [eligibilityForm, setEligibilityForm] = useState({
    classification: "",
    file: null
  })
  const [resumeAttentionActive, setResumeAttentionActive] = useState(false)
  const resumeSectionRef = useRef(null)
  const resumeInputRef = useRef(null)
  const supportingInputRef = useRef(null)
  const [confirmDeleteEducationId, setConfirmDeleteEducationId] = useState(null)
  const [confirmDeleteExperienceId, setConfirmDeleteExperienceId] = useState(null)
  const [confirmDeleteSupportingId, setConfirmDeleteSupportingId] = useState(null)
  const [confirmDeleteResume, setConfirmDeleteResume] = useState(false)
  const [confirmSavePersonnelProfile, setConfirmSavePersonnelProfile] = useState(false)
  const [confirmSaveAction, setConfirmSaveAction] = useState(null)

  const supportingTypeConfig = [
    { key: "certificate", label: "Certificate" },
    { key: "portfolio", label: "Portfolio" },
    { key: "transcript", label: "Transcript" },
    { key: "others", label: "Other Supporting Documents" }
  ]

  const educationLevelOptions = [
    "Elementary",
    "Junior High School",
    "Senior High School",
    "Vocational",
    "College",
    "Graduate Studies",
    "Doctorate"
  ]
  const graduationStatusOptions = [
    "Graduated",
    "Undergraduate",
    "Ongoing",
    "With Honors",
    "Cum Laude",
    "Magna Cum Laude",
    "Summa Cum Laude"
  ]
  const ldClassificationOptions = [
    "Managerial",
    "Supervisory",
    "Technical",
    "Foundation",
    "Leadership",
    "Professional Development",
    "Other"
  ]
  const governmentServiceOptions = ["Yes", "No"]
  const appointmentStatusOptions = [
    "Permanent",
    "Temporary",
    "Contractual",
    "Casual",
    "Job Order",
    "Part-time",
    "Other"
  ]
  const eligibilityClassificationOptions = [
    "Career Service Eligibility - Preference Rating (CSE-PR)",
    "Career Service Eligibility - Sub Professional (CSE-Sub)",
    "Career Service Eligibility - Professional (CSE-Prof)",
    "Bar/Board Eligibility (RA 1080)",
    "Barangay Health Worker Eligibility (RA 7883)",
    "Barangay Nutrition Scholar Eligibility (PD 1569)",
    "Barangay Official Eligibility (RA 7160)",
    "Electronic Data Processing Specialist Eligibility (CSC Res. 90-083)",
    "Foreign School Honor Graduate Eligibility (CSC Res. 1302714)",
    "Honor Graduate Eligibility (PD 907)",
    "Sanggunian Member Eligibility (RA 10156)",
    "Scientific and Technological Specialist Eligibility (PD 997)",
    "Skills Eligibility - Category II (CSC MC 11, s. 1996, as Amended)",
    "Veteran Preference Rating (EO 132/790)",
    "Other Eligibility"
  ]
  const academicYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: currentYear - 1949 }, (_, index) => String(currentYear - index))
  }, [])

  const supportingFiles = Array.isArray(jobSeekerSupporting) ? jobSeekerSupporting : []
  const requiredSupportingKeys = ["certificate", "portfolio", "transcript"]
  const supportingByType = supportingFiles.reduce((acc, item) => {
    const type = String(item?.type || "others")
    if (!acc[type]) acc[type] = []
    acc[type].push(item)
    return acc
  }, {})
  const supportingComplete = requiredSupportingKeys.every((key) => Array.isArray(supportingByType[key]) && supportingByType[key].length > 0)
  const eligibilityDocs = supportingFiles.filter((item) => String(item?.type || "").toLowerCase().startsWith("eligibility:"))

  const normalizeEducationItem = (item = {}) => ({
    id: item?.id ?? null,
    schoolName: item?.schoolName || item?.school_name || item?.school || "",
    degree: item?.degree || item?.program || "",
    startYear: item?.startYear || item?.start_year || "",
    endYear: item?.endYear || item?.end_year || "",
    description: item?.description || "",
  })

  const parseAcademicDescription = (description = "") => {
    const details = {
      educationLevel: "",
      graduationStatus: "",
      yearGraduated: "",
      academicHonors: "",
      honorsNotApplicable: false
    }

    String(description || "").split(/\r?\n/).forEach((line) => {
      const [rawLabel, ...valueParts] = line.split(":")
      if (!valueParts.length) return
      const label = rawLabel.trim().toLowerCase()
      const value = valueParts.join(":").trim()
      if (label === "educational level") details.educationLevel = value
      if (label === "graduation status rank") details.graduationStatus = value
      if (label === "year graduated") details.yearGraduated = value
      if (label === "academic honors / awards received") {
        details.academicHonors = value === "N/A" ? "" : value
        details.honorsNotApplicable = value === "N/A"
      }
    })

    return details
  }

  const buildAcademicDescription = (state = {}) => {
    const lines = []
    const honors = state.honorsNotApplicable ? "N/A" : String(state.academicHonors || "").trim()

    if (state.educationLevel) lines.push(`Educational Level: ${state.educationLevel}`)
    if (state.graduationStatus) lines.push(`Graduation Status Rank: ${state.graduationStatus}`)
    if (state.yearGraduated) lines.push(`Year Graduated: ${state.yearGraduated}`)
    if (honors) lines.push(`Academic Honors / Awards Received: ${honors}`)

    return lines.join("\n") || state.educationDescription || ""
  }

  const parseTrainingDescription = (description = "") => {
    const details = {
      trainingHours: "",
      ldClassification: "",
      trainingCertificateName: ""
    }

    String(description || "").split(/\r?\n/).forEach((line) => {
      const [rawLabel, ...valueParts] = line.split(":")
      if (!valueParts.length) return
      const label = rawLabel.trim().toLowerCase()
      const value = valueParts.join(":").trim()
      if (label === "number of hours credit") details.trainingHours = value
      if (label === "type of ld classification") details.ldClassification = value
      if (label === "certificate file") details.trainingCertificateName = value
    })

    return details
  }

  const buildTrainingDescription = (state = {}) => {
    const lines = ["Record Type: Training"]
    if (state.trainingHours) lines.push(`Number of Hours Credit: ${state.trainingHours}`)
    if (state.ldClassification) lines.push(`Type of LD Classification: ${state.ldClassification}`)
    if (state.trainingCertificateFile?.name || state.trainingCertificateName) {
      lines.push(`Certificate File: ${state.trainingCertificateFile?.name || state.trainingCertificateName}`)
    }

    return lines.join("\n") || state.experienceDescription || ""
  }

  const parseWorkExperienceDescription = (description = "") => {
    const details = {
      governmentService: "",
      monthlySalary: "",
      salaryGrade: "",
      appointmentStatus: "",
      coeFileName: ""
    }

    String(description || "").split(/\r?\n/).forEach((line) => {
      const [rawLabel, ...valueParts] = line.split(":")
      if (!valueParts.length) return
      const label = rawLabel.trim().toLowerCase()
      const value = valueParts.join(":").trim()
      if (label === "government service") details.governmentService = value
      if (label === "monthly gross salary") details.monthlySalary = value
      if (label === "salary grade") details.salaryGrade = value
      if (label === "status of appointment") details.appointmentStatus = value
      if (label === "coe file") details.coeFileName = value
    })

    return details
  }

  const buildWorkExperienceDescription = (state = {}) => {
    const lines = ["Record Type: Work Experience"]
    if (state.governmentService) lines.push(`Government Service: ${state.governmentService}`)
    if (state.monthlySalary) lines.push(`Monthly Gross Salary: ${state.monthlySalary}`)
    if (state.salaryGrade) lines.push(`Salary Grade: ${state.salaryGrade}`)
    if (state.appointmentStatus) lines.push(`Status of Appointment: ${state.appointmentStatus}`)
    if (state.coeFile?.name || state.coeFileName) {
      lines.push(`COE File: ${state.coeFile?.name || state.coeFileName}`)
    }

    return lines.join("\n") || state.experienceDescription || ""
  }

  const isTrainingExperience = (item = {}) => {
    const description = String(item?.description || "").toLowerCase()
    return description.includes("record type: training") ||
      description.includes("number of hours credit:") ||
      description.includes("type of ld classification:") ||
      description.includes("certificate file:")
  }

  const visibleDescriptionLines = (description = "") => (
    String(description || "")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.toLowerCase().startsWith("record type:"))
  )

  const eligibilityDocType = (classification = "") => `eligibility:${classification}`

  const eligibilityClassificationFromType = (type = "") => {
    const value = String(type || "")
    return value.toLowerCase().startsWith("eligibility:")
      ? value.slice(value.indexOf(":") + 1)
      : "Eligibility"
  }

  const isBlank = (value) => String(value || "").trim() === ""

  const hasInvalidField = (field) => invalidFields.includes(field)
  const inputClass = (field, baseClass = "input") => `${baseClass}${hasInvalidField(field) ? " input-error" : ""}`

  const profileStatusToastClass = (message) => {
    const normalized = String(message || "").trim().toLowerCase()
    if (normalized === "saving..." || normalized === "removing...") return "toast toast-info profile-form-toast"
    if (normalized.includes("saved")) return "toast toast-success profile-form-toast"
    return "toast toast-fail profile-form-toast"
  }

  const validateDocumentFile = (file, label) => {
    if (!file) return ""
    const lowerName = String(file.name || "").toLowerCase()
    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg"]
    return allowedExtensions.some((extension) => lowerName.endsWith(extension))
      ? ""
      : `${label} must be a PDF, PNG, JPG, or JPEG document.`
  }

  const getInvalidEducationFields = () => {
    const fields = []
    if (isBlank(formState.educationLevel)) fields.push("educationLevel")
    if (isBlank(formState.graduationStatus)) fields.push("graduationStatus")
    if (isBlank(formState.schoolName)) fields.push("schoolName")
    if (isBlank(formState.degree)) fields.push("degree")
    if (isBlank(formState.startYear)) fields.push("startYear")
    if (isBlank(formState.endYear)) fields.push("endYear")
    if (isBlank(formState.yearGraduated)) fields.push("yearGraduated")
    if (!formState.honorsNotApplicable && isBlank(formState.academicHonors)) fields.push("academicHonors")
    if (formState.startYear && formState.endYear && Number(formState.startYear) > Number(formState.endYear)) {
      fields.push("startYear", "endYear")
    }
    return Array.from(new Set(fields))
  }

  const getInvalidExperienceFields = () => {
    const fields = []
    const isTrainingRecord = formState.experienceCategory === "training"

    if (isTrainingRecord) {
      if (isBlank(formState.position)) fields.push("position")
      if (isBlank(formState.startDate)) fields.push("startDate")
      if (isBlank(formState.endDate)) fields.push("endDate")
      if (formState.startDate && formState.endDate && formState.startDate > formState.endDate) fields.push("startDate", "endDate")
      const trainingHours = Number(String(formState.trainingHours || "").replace(/,/g, ""))
      if (isBlank(formState.trainingHours) || !Number.isFinite(trainingHours) || trainingHours <= 0) fields.push("trainingHours")
      if (isBlank(formState.ldClassification)) fields.push("ldClassification")
      if (isBlank(formState.companyName)) fields.push("companyName")
      if (!formState.trainingCertificateFile && !formState.trainingCertificateName) fields.push("trainingCertificateFile")
      if (validateDocumentFile(formState.trainingCertificateFile, "Certificate of training")) fields.push("trainingCertificateFile")
      return Array.from(new Set(fields))
    }

    if (isBlank(formState.position)) fields.push("position")
    if (isBlank(formState.startDate)) fields.push("startDate")
    if (isBlank(formState.endDate)) fields.push("endDate")
    if (formState.startDate && formState.endDate && formState.endDate !== "Present" && formState.startDate > formState.endDate) fields.push("startDate", "endDate")
    if (isBlank(formState.companyName)) fields.push("companyName")
    if (isBlank(formState.governmentService)) fields.push("governmentService")
    const monthlySalary = Number(String(formState.monthlySalary || "").replace(/,/g, ""))
    if (isBlank(formState.monthlySalary) || !Number.isFinite(monthlySalary) || monthlySalary <= 0) fields.push("monthlySalary")
    if (isBlank(formState.appointmentStatus)) fields.push("appointmentStatus")
    if (!formState.coeFile && !formState.coeFileName) fields.push("coeFile")
    if (validateDocumentFile(formState.coeFile, "Certificate of employment")) fields.push("coeFile")
    return Array.from(new Set(fields))
  }

  const getInvalidEligibilityFields = () => {
    const fields = []
    if (!eligibilityForm.classification) fields.push("eligibilityClassification")
    if (!eligibilityForm.file) fields.push("eligibilityFile")
    if (validateDocumentFile(eligibilityForm.file, "Eligibility certificate")) fields.push("eligibilityFile")
    return Array.from(new Set(fields))
  }

  const normalizeExperienceItem = (item = {}) => ({
    id: item?.id ?? null,
    companyName: item?.companyName || item?.company_name || item?.company || "",
    position: item?.position || item?.title || "",
    startDate: item?.startDate || item?.start_date || "",
    endDate: item?.endDate || item?.end_date || "",
    description: item?.description || "",
  })

  const normalizeProfilePayload = (payload) => {
    const source = payload?.jobSeeker || payload || {}
    const educationSource = payload?.educations ?? source?.education ?? source?.educations ?? []
    const experienceSource = payload?.experiences ?? source?.experience ?? source?.experiences ?? []

    return {
      id: source.id ?? payload?.jobSeekerId ?? payload?.job_seeker_id ?? null,
      idNumber: source.idNumber || source.id_number || "",
      fullName: source.fullName || source.full_name || loginEmail?.split("@")?.[0] || "Job Seeker",
      full_name: source.full_name || source.fullName || loginEmail?.split("@")?.[0] || "Job Seeker",
      email: source.email || loginEmail || "",
      username: source.username || "",
      phone: source.phone || "",
      status: source.status || "",
      address: source.address || source.location || "",
      aboutText: source.aboutText || "",
      linkedInUrl: source.linkedInUrl || "",
      createdAt: source.createdAt || source.created_at || null,
      education: Array.isArray(educationSource) ? educationSource.map(normalizeEducationItem) : [],
    experience: Array.isArray(experienceSource) ? experienceSource.map(normalizeExperienceItem) : [],
    }
  }

  const normalizedJobSeekerProfile = isJobSeeker && jobSeekerProfile
    ? normalizeProfilePayload(jobSeekerProfile)
    : jobSeekerProfile

  const isEmployerProfile = userRole === "employer" || currentUser?.role === "employer"

  const formatJobSeekerUniqueId = (profile) => {
    const explicitId = String(profile?.idNumber || profile?.id_number || "").trim()
    if (explicitId) return explicitId
    const numericId = Number(profile?.id)
    return Number.isFinite(numericId) && numericId > 0 ? `LNU-${String(numericId).padStart(6, "0")}` : "-"
  }

  const displayName = isJobSeeker
    ? (normalizedJobSeekerProfile?.fullName || "Job Seeker")
    : (currentUser?.name || (loginEmail ? loginEmail.split("@")[0] : "Personnel"))
  const email = isJobSeeker ? (normalizedJobSeekerProfile?.email || "-") : (currentUser?.email || loginEmail || "-")
  const uniqueId = isJobSeeker ? formatJobSeekerUniqueId(normalizedJobSeekerProfile) : "-"
  const username = isJobSeeker
    ? (normalizedJobSeekerProfile?.username || "-")
    : (currentUser?.username || (currentUser?.email ? currentUser.email.split("@")[0] : (loginEmail ? loginEmail.split("@")[0] : "-")))
  const personnelIdNumber = currentUser?.idNumber || currentUser?.id_number || "-"
  const phone = isJobSeeker ? (normalizedJobSeekerProfile?.phone || "-") : (currentUser?.phone || "-")
  const status = isJobSeeker ? (normalizedJobSeekerProfile?.status || "-") : "-"
  const profileCreatedAt = isJobSeeker ? normalizedJobSeekerProfile?.createdAt : (currentUser?.createdAt || currentUser?.created_at)
  const createdAt = profileCreatedAt
    ? new Date(profileCreatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "-"
  const address = isJobSeeker ? (normalizedJobSeekerProfile?.address || normalizedJobSeekerProfile?.location || "") : ""
  const aboutText = isJobSeeker ? (normalizedJobSeekerProfile?.aboutText || "") : ""
  const education = isJobSeeker ? (normalizedJobSeekerProfile?.education || []) : []
  const experience = isJobSeeker ? (normalizedJobSeekerProfile?.experience || []) : []
  const trainingExperience = experience.filter(isTrainingExperience)
  const workExperience = experience.filter((item) => !isTrainingExperience(item))
  const pendingDeleteExperienceItem = confirmDeleteExperienceId != null
    ? experience.find((item) => item.id === confirmDeleteExperienceId)
    : null
  const pendingDeleteExperienceIsTraining = isTrainingExperience(pendingDeleteExperienceItem)
  const pendingDeleteSupportingItem = confirmDeleteSupportingId != null
    ? supportingFiles.find((item) => item.id === confirmDeleteSupportingId)
    : null
  const pendingDeleteSupportingIsEligibility = String(pendingDeleteSupportingItem?.type || "").toLowerCase().startsWith("eligibility:")
  const resumeUpdatedAt = jobSeekerResume?.updatedAt
    ? new Date(jobSeekerResume.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : ""

  const normalizePhoneInput = (value) => {
    const digitsOnly = String(value || "").replace(/\D/g, "")
    const withoutCountryPrefix = digitsOnly.startsWith("63") ? digitsOnly.slice(2) : digitsOnly
    const withoutLocalPrefix = withoutCountryPrefix.startsWith("0")
      ? withoutCountryPrefix.slice(1)
      : withoutCountryPrefix
    return withoutLocalPrefix.slice(0, 10)
  }

  const formatPhoneWithPrefix = (value) => {
    const normalized = normalizePhoneInput(value)
    return normalized ? `+63${normalized}` : ""
  }

  const formatPhoneInputValue = (value) => {
    const normalized = normalizePhoneInput(value)
    return normalized ? `+63${normalized}` : "+63"
  }

  const resolvedJobSeekerId = jobSeekerId || normalizedJobSeekerProfile?.id || null

  useEffect(() => {
    if (resumeAttention) {
      setResumeAttentionActive(true)
      onResumeAttentionConsumed?.()
      resumeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [resumeAttention, onResumeAttentionConsumed])

  useEffect(() => {
    if (jobSeekerResume) {
      setResumeAttentionActive(false)
    }
  }, [jobSeekerResume])

  useEffect(() => {
    if (!supportingErrorToast) return undefined
    const timeoutId = window.setTimeout(() => {
      setSupportingErrorToast("")
    }, 3000)
    return () => window.clearTimeout(timeoutId)
  }, [supportingErrorToast])

  useEffect(() => {
    if (!isJobSeeker) return
    if (!resolvedJobSeekerId) return
    const hasEducation = Array.isArray(normalizedJobSeekerProfile?.education)
    const hasExperience = Array.isArray(normalizedJobSeekerProfile?.experience)
    if (normalizedJobSeekerProfile?.id === resolvedJobSeekerId && normalizedJobSeekerProfile?.createdAt && hasEducation && hasExperience) {
      return
    }
    let isMounted = true

    const fetchProfile = async () => {
      setIsLoadingProfile(true)
      setProfileError("")
      try {
        const response = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}`)
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.message || "Failed to load profile.")
        }
        const data = await response.json()
        if (!isMounted) return
        onJobSeekerProfileUpdate?.(normalizeProfilePayload(data))
      } catch (error) {
        if (!isMounted) return
        setProfileError(error.message || "Failed to load profile.")
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false)
        }
      }
    }

    fetchProfile()

    return () => {
      isMounted = false
    }
  }, [isJobSeeker, resolvedJobSeekerId, normalizedJobSeekerProfile?.id, normalizedJobSeekerProfile?.createdAt, onJobSeekerProfileUpdate])

  const openEditProfile = () => {
    setFormState({
      fullName: isJobSeeker && displayName === "Job Seeker" ? "" : displayName,
      username: isJobSeeker ? (normalizedJobSeekerProfile?.username || "") : username,
      email,
      phone: isJobSeeker ? normalizePhoneInput(normalizedJobSeekerProfile?.phone || "") : normalizePhoneInput(currentUser?.phone || ""),
      idNumber: !isJobSeeker ? (currentUser?.idNumber || currentUser?.id_number || "") : "",
      address: isJobSeeker ? (normalizedJobSeekerProfile?.address || "") : "",
      school: "",
      program: "",
      year: "",
      title: "",
      company: "",
      password: "",
      confirmPassword: ""
    })
    setEditingItem(null)
    setEditMode("profile")
  }

  const openEditAbout = () => {
    setFormState((prev) => ({
      ...prev,
      aboutText
    }))
    setEditingItem(null)
    setEditMode("about")
  }

  const openContactInfo = () => {
    setContactForm({
      linkedInUrl: jobSeekerProfile?.linkedInUrl || "",
      email: jobSeekerProfile?.email || email || "",
      phone: normalizePhoneInput(jobSeekerProfile?.phone || phone || "")
    })
    setIsContactOpen(true)
    setIsEditingContact(false)
  }

  const saveContactInfo = async () => {
    if (!resolvedJobSeekerId) {
      setSaveStatus("Missing job seeker id.")
      return
    }
    setSaveStatus("Saving...")
    try {
      const response = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formState.fullName || displayName,
          username: formState.username || username,
          email: contactForm.email || email,
          phone: formatPhoneWithPrefix(contactForm.phone || phone),
          address,
          aboutText,
          linkedInUrl: contactForm.linkedInUrl
        })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Failed to update contact info.")
      }
      await refreshProfile()
      setSaveStatus("")
      setIsContactOpen(false)
    } catch (error) {
      setSaveStatus(error.message || "Failed to update.")
    }
  }

  const openEditEducation = (item = null) => {
    const academicDetails = parseAcademicDescription(item?.description || "")
    setFormState((prev) => ({
      ...prev,
      schoolName: item?.schoolName || item?.school_name || item?.school || "",
      degree: item?.degree || item?.program || "",
      startYear: item?.startYear || item?.start_year || "",
      endYear: item?.endYear || item?.end_year || "",
      educationDescription: item?.description || "",
      educationLevel: academicDetails.educationLevel,
      graduationStatus: academicDetails.graduationStatus,
      yearGraduated: academicDetails.yearGraduated,
      academicHonors: academicDetails.academicHonors,
      honorsNotApplicable: academicDetails.honorsNotApplicable
    }))
    setEditingItem(item)
    setSaveStatus("")
    setInvalidFields([])
    setEditMode("education")
  }

  const openEditTraining = (item = null) => {
    const trainingDetails = parseTrainingDescription(item?.description || "")
    setFormState((prev) => ({
      ...prev,
      experienceCategory: "training",
      companyName: item?.companyName || item?.company_name || item?.company || "",
      position: item?.position || item?.title || "",
      startDate: item?.startDate || item?.start_date || "",
      endDate: item?.endDate || item?.end_date || "",
      experienceDescription: item?.description || "",
      trainingHours: trainingDetails.trainingHours,
      ldClassification: trainingDetails.ldClassification,
      trainingCertificateName: trainingDetails.trainingCertificateName,
      trainingCertificateFile: null,
      governmentService: "",
      monthlySalary: "",
      salaryGrade: "",
      appointmentStatus: "",
      coeFileName: "",
      coeFile: null
    }))
    setEditingItem(item)
    setSaveStatus("")
    setInvalidFields([])
    setEditMode("experience")
  }

  const openEditWorkExperience = (item = null) => {
    const workDetails = parseWorkExperienceDescription(item?.description || "")
    setFormState((prev) => ({
      ...prev,
      experienceCategory: "work",
      companyName: item?.companyName || item?.company_name || item?.company || "",
      position: item?.position || item?.title || "",
      startDate: item?.startDate || item?.start_date || "",
      endDate: item?.endDate || item?.end_date || "",
      experienceDescription: item?.description || "",
      governmentService: workDetails.governmentService,
      monthlySalary: workDetails.monthlySalary,
      salaryGrade: workDetails.salaryGrade,
      appointmentStatus: workDetails.appointmentStatus,
      coeFileName: workDetails.coeFileName,
      coeFile: null,
      trainingHours: "",
      ldClassification: "",
      trainingCertificateName: "",
      trainingCertificateFile: null
    }))
    setEditingItem(item)
    setSaveStatus("")
    setInvalidFields([])
    setEditMode("experience")
  }

  const closeEdit = () => {
    setEditMode(null)
    setEditingItem(null)
    setSaveStatus("")
    setInvalidFields([])
    setConfirmSavePersonnelProfile(false)
    setConfirmSaveAction(null)
  }

  const refreshProfile = async () => {
    if (!resolvedJobSeekerId) {
      setProfileError("Missing job seeker id.")
      return
    }
    try {
      const response = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}`)
      if (!response.ok) {
        throw new Error("Failed to refresh profile.")
      }
      const data = await response.json()
      onJobSeekerProfileUpdate?.(normalizeProfilePayload(data))
    } catch (error) {
      setProfileError(error.message || "Failed to load profile.")
    }
  }

  const updateProfileLocal = (updater) => {
    if (!jobSeekerProfile) return
    const next = updater(jobSeekerProfile)
    onJobSeekerProfileUpdate?.(next)
  }

  const saveProfile = async () => {
    if (!isJobSeeker) {
      if (!currentUser?.id) {
        setSaveStatus("Missing personnel id.")
        return
      }
      if (formState.password && formState.password !== formState.confirmPassword) {
        setSaveStatus("Passwords do not match.")
        return
      }
      setSaveStatus("Saving...")
      try {
        const response = isEmployerProfile
          ? await fetch(`/api/employers/${currentUser.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              companyName: formState.fullName,
              email: formState.email,
              username: formState.username,
              idNumber: formState.idNumber,
              phone: formState.phone ? formatPhoneWithPrefix(formState.phone) : "",
              password: formState.password || undefined
            })
          })
          : await fetch("/api/staff/me", {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              id: currentUser.id,
              name: formState.fullName,
              email: formState.email,
              username: formState.username,
              phone: formState.phone ? formatPhoneWithPrefix(formState.phone) : "",
              password: formState.password || undefined
            })
          })
        const payload = await readJsonResponse(response)
        if (!response.ok) {
          const firstError =
            payload?.errors?.name?.[0] ||
            payload?.errors?.company_name?.[0] ||
            payload?.errors?.email?.[0] ||
            payload?.errors?.username?.[0] ||
            payload?.errors?.id_number?.[0] ||
            payload?.errors?.phone?.[0] ||
            payload?.errors?.password?.[0]
          throw new Error(payload?.message || firstError || "Failed to update profile.")
        }
        onCurrentUserUpdate?.(payload)
        setSaveStatus("Saved.")
        closeEdit()
      } catch (error) {
        setSaveStatus(error.message || "Failed to update.")
      }
      return
    }

    if (!resolvedJobSeekerId) {
      setSaveStatus("Missing job seeker id.")
      return
    }
    setSaveStatus("Saving...")
    try {
      const response = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editMode === "profile" ? formState.fullName : displayName,
          username: editMode === "profile" ? formState.username : (normalizedJobSeekerProfile?.username || ""),
          email: editMode === "profile" ? formState.email : email,
          phone: editMode === "profile" ? formatPhoneWithPrefix(formState.phone) : (normalizedJobSeekerProfile?.phone || ""),
          address: editMode === "profile" ? formState.address : (normalizedJobSeekerProfile?.address || ""),
          aboutText: editMode === "about"
            ? (formState.aboutText || "")
            : aboutText
        })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Failed to update profile.")
      }
      await refreshProfile()
      setSaveStatus("Saved.")
      closeEdit()
    } catch (error) {
      setSaveStatus(error.message || "Failed to update.")
    }
  }

  const validateEducationForm = () => {
    const requiredFields = [
      [formState.educationLevel, "Select an educational level."],
      [formState.graduationStatus, "Select a graduation status."],
      [formState.schoolName, "Enter the school name."],
      [formState.degree, "Enter the degree or course."],
      [formState.startYear, "Select the start year."],
      [formState.endYear, "Select the end year."],
      [formState.yearGraduated, "Select the year graduated."]
    ]
    const missing = requiredFields.find(([value]) => isBlank(value))
    if (missing) return missing[1]
    if (!formState.honorsNotApplicable && isBlank(formState.academicHonors)) {
      return "Enter academic honors/awards or check Not Applicable."
    }
    if (Number(formState.startYear) > Number(formState.endYear)) {
      return "From Year cannot be later than To Year."
    }
    return ""
  }

  const validateExperienceForm = () => {
    const isTrainingRecord = formState.experienceCategory === "training"
    if (isTrainingRecord) {
      const requiredFields = [
        [formState.position, "Enter the training program or course title."],
        [formState.startDate, "Select the training start date."],
        [formState.endDate, "Select the training end date."],
        [formState.trainingHours, "Enter the number of hours credit."],
        [formState.ldClassification, "Select an LD classification."],
        [formState.companyName, "Enter who conducted or sponsored the training."]
      ]
      const missing = requiredFields.find(([value]) => isBlank(value))
      if (missing) return missing[1]
      if (formState.startDate && formState.endDate && formState.endDate !== "Present" && formState.startDate > formState.endDate) {
        return "Training start date cannot be later than end date."
      }
      const trainingHours = Number(String(formState.trainingHours || "").replace(/,/g, ""))
      if (!Number.isFinite(trainingHours) || trainingHours <= 0) {
        return "Training hours must be greater than zero."
      }
      if (!formState.trainingCertificateFile && !formState.trainingCertificateName) {
        return "Upload a certificate of training."
      }
      return validateDocumentFile(formState.trainingCertificateFile, "Certificate of training")
    }

    const requiredFields = [
      [formState.position, "Enter the position title."],
      [formState.startDate, "Select the start date."],
      [formState.endDate, "Select the end date or check Present."],
      [formState.companyName, "Enter the department, agency, or company name."],
      [formState.governmentService, "Select whether this is government service."],
      [formState.monthlySalary, "Enter the monthly gross salary."],
      [formState.appointmentStatus, "Select the status of appointment."]
    ]
    const missing = requiredFields.find(([value]) => isBlank(value))
    if (missing) return missing[1]
    if (formState.startDate && formState.endDate && formState.endDate !== "Present" && formState.startDate > formState.endDate) {
      return "Experience start date cannot be later than end date."
    }
    const monthlySalary = Number(String(formState.monthlySalary || "").replace(/,/g, ""))
    if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
      return "Monthly gross salary must be greater than zero."
    }
    if (!formState.coeFile && !formState.coeFileName) {
      return "Upload a certificate of employment."
    }
    return validateDocumentFile(formState.coeFile, "Certificate of employment")
  }

  const validateEligibilityForm = () => {
    if (!resolvedJobSeekerId) return "Missing job seeker id."
    if (!eligibilityForm.classification) return "Select an eligibility classification."
    if (!eligibilityForm.file) return "Upload an eligibility certificate."
    return validateDocumentFile(eligibilityForm.file, "Eligibility certificate")
  }

  const requestEducationSave = () => {
    const invalid = getInvalidEducationFields()
    setInvalidFields(invalid)
    const message = validateEducationForm()
    if (message) {
      setSaveStatus(message)
      return
    }
    setSaveStatus("")
    setConfirmSaveAction({
      type: "education",
      title: `${editingItem ? "Save" : "Add"} Education`,
      message: `Are you sure you want to ${editingItem ? "save changes to" : "add"} this education record?`
    })
  }

  const requestExperienceSave = () => {
    const invalid = getInvalidExperienceFields()
    setInvalidFields(invalid)
    const message = validateExperienceForm()
    if (message) {
      setSaveStatus(message)
      return
    }
    const isTrainingRecord = formState.experienceCategory === "training"
    setSaveStatus("")
    setConfirmSaveAction({
      type: "experience",
      title: `${editingItem ? "Save" : "Add"} ${isTrainingRecord ? "Training" : "Job Experience"}`,
      message: `Are you sure you want to ${editingItem ? "save changes to" : "add"} this ${isTrainingRecord ? "training" : "job experience"} record?`
    })
  }

  const requestEligibilitySave = () => {
    const invalid = getInvalidEligibilityFields()
    setInvalidFields(invalid)
    const message = validateEligibilityForm()
    if (message) {
      setEligibilityStatus(message)
      return
    }
    setEligibilityStatus("")
    setConfirmSaveAction({
      type: "eligibility",
      title: "Add Eligibility",
      message: "Are you sure you want to add this board/civil eligibility record?"
    })
  }

  const saveEducation = async () => {
    if (!resolvedJobSeekerId) {
      setSaveStatus("Missing job seeker id.")
      return
    }
    const validationMessage = validateEducationForm()
    if (validationMessage) {
      setInvalidFields(getInvalidEducationFields())
      setSaveStatus(validationMessage)
      return
    }
    setSaveStatus("Saving...")
    const educationDescription = buildAcademicDescription(formState)
    try {
      const response = await fetch(
        `http://localhost:5000/job-seekers/${resolvedJobSeekerId}/education${editingItem?.id ? `/${editingItem.id}` : ""}`,
        {
          method: editingItem?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            school_name: formState.schoolName,
            degree: formState.degree,
            start_year: formState.startYear,
            end_year: formState.endYear,
            description: educationDescription
          })
        }
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Failed to save education.")
      }
      const payload = await response.json().catch(() => null)
      const savedItem = normalizeEducationItem(payload || {
        id: editingItem?.id,
        school_name: formState.schoolName,
        degree: formState.degree,
        start_year: formState.startYear,
        end_year: formState.endYear,
        description: educationDescription
      })
      updateProfileLocal((prev) => {
        const list = Array.isArray(prev.education) ? [...prev.education] : []
        if (editingItem?.id) {
          return {
            ...prev,
            education: list.map((item) => (item.id === editingItem.id ? savedItem : item))
          }
        }
        return { ...prev, education: [savedItem, ...list] }
      })
      await refreshProfile()
      setSaveStatus("Saved.")
      setInvalidFields([])
      closeEdit()
    } catch (error) {
      setSaveStatus(error.message || "Failed to update.")
    }
  }

  const performDeleteEducation = async (itemId) => {
    if (!resolvedJobSeekerId) {
      setProfileError("Missing job seeker id.")
      return
    }
    try {
      const response = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/education/${itemId}`, {
        method: "DELETE"
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Failed to delete education.")
      }
      updateProfileLocal((prev) => ({
        ...prev,
        education: (prev.education || []).filter((item) => item.id !== itemId)
      }))
      await refreshProfile()
    } catch (error) {
      setProfileError(error.message || "Failed to delete education.")
    }
  }

  const deleteEducation = (itemId) => {
    setConfirmDeleteEducationId(itemId)
  }

  const saveExperience = async () => {
    if (!resolvedJobSeekerId) {
      setSaveStatus("Missing job seeker id.")
      return
    }
    const validationMessage = validateExperienceForm()
    if (validationMessage) {
      setInvalidFields(getInvalidExperienceFields())
      setSaveStatus(validationMessage)
      return
    }
    setSaveStatus("Saving...")
    const isTrainingRecord = formState.experienceCategory === "training"
    const experienceDescription = isTrainingRecord
      ? buildTrainingDescription(formState)
      : buildWorkExperienceDescription(formState)
    try {
      const response = await fetch(
        `http://localhost:5000/job-seekers/${resolvedJobSeekerId}/experience${editingItem?.id ? `/${editingItem.id}` : ""}`,
        {
          method: editingItem?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: formState.companyName,
            position: formState.position,
            start_date: formState.startDate,
            end_date: formState.endDate,
            description: experienceDescription
          })
        }
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Failed to save experience.")
      }
      const payload = await response.json().catch(() => null)
      const savedItem = normalizeExperienceItem(payload || {
        id: editingItem?.id,
        company_name: formState.companyName,
        position: formState.position,
        start_date: formState.startDate,
        end_date: formState.endDate,
        description: experienceDescription
      })
      const supportingFile = isTrainingRecord ? formState.trainingCertificateFile : formState.coeFile
      const supportingType = isTrainingRecord ? "certificate" : "others"
      const uploadFailureMessage = isTrainingRecord
        ? "Training saved, but certificate upload failed."
        : "Experience saved, but COE upload failed."
      if (supportingFile) {
        const certificateData = new FormData()
        certificateData.append("supportingFiles", supportingFile)
        certificateData.append("supportingTypes", supportingType)
        const certificateResponse = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/supporting`, {
          method: "POST",
          body: certificateData
        })
        if (!certificateResponse.ok) {
          const payload = await certificateResponse.json().catch(() => null)
          throw new Error(payload?.message || uploadFailureMessage)
        }
        await refreshSupportingFiles()
      }
      updateProfileLocal((prev) => {
        const list = Array.isArray(prev.experience) ? [...prev.experience] : []
        if (editingItem?.id) {
          return {
            ...prev,
            experience: list.map((item) => (item.id === editingItem.id ? savedItem : item))
          }
        }
        return { ...prev, experience: [savedItem, ...list] }
      })
      await refreshProfile()
      setSaveStatus("Saved.")
      setInvalidFields([])
      closeEdit()
    } catch (error) {
      setSaveStatus(error.message || "Failed to update.")
    }
  }

  const performDeleteExperience = async (itemId) => {
    if (!resolvedJobSeekerId) {
      setProfileError("Missing job seeker id.")
      return
    }
    try {
      const response = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/experience/${itemId}`, {
        method: "DELETE"
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Failed to delete experience.")
      }
      updateProfileLocal((prev) => ({
        ...prev,
        experience: (prev.experience || []).filter((item) => item.id !== itemId)
      }))
      await refreshProfile()
    } catch (error) {
      setProfileError(error.message || "Failed to delete experience.")
    }
  }

  const deleteExperience = (itemId) => {
    setConfirmDeleteExperienceId(itemId)
  }

  const refreshSupportingFiles = async () => {
    if (!resolvedJobSeekerId) {
      return []
    }

    const response = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/supporting`)
    if (!response.ok) {
      throw new Error("Failed to refresh supporting documents.")
    }

    const payload = await response.json().catch(() => null)
    const files = Array.isArray(payload?.files) ? payload.files : []
    onJobSeekerSupportingUpdate?.(files)
    return files
  }

  const handleResumeUpload = (file) => {
    if (!file) return
    if (!resolvedJobSeekerId) {
      setResumeStatus("Missing job seeker id.")
      if (resumeInputRef.current) {
        resumeInputRef.current.value = ""
      }
      return
    }
    setResumeStatus("Uploading...")
    const formData = new FormData()
    formData.append("file", file)
    fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/resume`, {
      method: "POST",
      body: formData
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.message || "Failed to upload Personal Data Sheet(PDS).")
        }
        return response.json()
      })
      .then((payload) => {
        onJobSeekerResumeUpdate?.(payload?.resume || null)
        setResumeStatus(jobSeekerResume ? "Replaced." : "Saved.")
        setTimeout(() => setResumeStatus(""), 2000)
      })
      .catch((error) => {
        setResumeStatus(error.message || "Failed to upload Personal Data Sheet(PDS).")
      })
      .finally(() => {
        if (resumeInputRef.current) {
          resumeInputRef.current.value = ""
        }
      })
  }

  const handleResumeDelete = async () => {
    if (!resolvedJobSeekerId) {
      setResumeStatus("Missing job seeker id.")
      return
    }

    try {
      setResumeStatus("Deleting...")
      const response = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/resume`, {
        method: "DELETE"
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Failed to delete Personal Data Sheet(PDS).")
      }
      onJobSeekerResumeUpdate?.(null)
      setResumeStatus("Deleted.")
      setTimeout(() => setResumeStatus(""), 2000)
    } catch (error) {
      setResumeStatus(error.message || "Failed to delete Personal Data Sheet(PDS).")
    }
  }

  const openSupportingUpload = (type) => {
    setPendingSupportingType(type)
    supportingInputRef.current?.click()
  }

  const handleSupportingUpload = (selectedFiles) => {
    const files = Array.from(selectedFiles || []).filter(Boolean)
    if (!files.length) return

    const uploadFiles = pendingSupportingType === "others" ? files : files.slice(0, 1)
    if (!uploadFiles.length) return

    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg"]
    const hasUnsupportedFile = uploadFiles.some((file) => {
      const lowerName = String(file.name || "").toLowerCase()
      return !allowedExtensions.some((extension) => lowerName.endsWith(extension))
    })
    if (hasUnsupportedFile) {
      setSupportingStatus("")
      setSupportingErrorToast("Wrong credential file. Upload a PDF, PNG, JPG, or JPEG document.")
      return
    }

    if (!resolvedJobSeekerId) {
      setSupportingStatus("")
      setSupportingErrorToast("Missing job seeker id.")
      return
    }
    setSupportingErrorToast("")
    setSupportingStatus(`Uploading ${uploadFiles.length} file${uploadFiles.length === 1 ? "" : "s"}...`)
    const formData = new FormData()
    uploadFiles.forEach((file) => {
      formData.append("supportingFiles", file)
      formData.append("supportingTypes", pendingSupportingType || "others")
    })

    fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/supporting`, {
      method: "POST",
      body: formData
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await readJsonResponse(response).catch(() => null)
          throw new Error(payload?.message || "Failed to upload supporting document.")
        }
        return readJsonResponse(response)
      })
      .then(() => {
        return refreshSupportingFiles().then(() => {
          setSupportingStatus(`Saved ${uploadFiles.length} file${uploadFiles.length === 1 ? "" : "s"}.`)
          setTimeout(() => setSupportingStatus(""), 2000)
        })
      })
      .catch((error) => {
        setSupportingStatus("")
        setSupportingErrorToast(error.message || "Failed to upload supporting document.")
      })
  }

  const handleEligibilitySubmit = () => {
    const validationMessage = validateEligibilityForm()
    if (validationMessage) {
      setInvalidFields(getInvalidEligibilityFields())
      setEligibilityStatus(validationMessage)
      return
    }

    setEligibilityStatus("Saving...")
    const formData = new FormData()
    formData.append("supportingFiles", eligibilityForm.file)
    formData.append("supportingTypes", eligibilityDocType(eligibilityForm.classification))

    fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/supporting`, {
      method: "POST",
      body: formData
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await readJsonResponse(response).catch(() => null)
          throw new Error(payload?.message || "Failed to upload eligibility certificate.")
        }
        return readJsonResponse(response)
      })
      .then(() => {
        return refreshSupportingFiles().then(() => {
          setEligibilityForm({ classification: "", file: null })
          setInvalidFields([])
          setEligibilityStatus("")
          setIsEligibilityModalOpen(false)
        })
      })
      .catch((error) => {
        setEligibilityStatus(error.message || "Failed to upload eligibility certificate.")
      })
  }

  const handleSupportingDelete = (supportId) => {
    if (!resolvedJobSeekerId) {
      setSupportingStatus("Missing job seeker id.")
      return
    }
    setSupportingStatus("Removing...")
    fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/supporting/${supportId}`, {
      method: "DELETE"
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.message || "Failed to remove supporting document.")
        }
      })
      .then(() => {
        return refreshSupportingFiles().then(() => {
          setSupportingStatus("Removed.")
          setTimeout(() => setSupportingStatus(""), 2000)
        })
      })
      .catch((error) => {
        setSupportingStatus(error.message || "Failed to remove supporting document.")
      })
  }

  return (
    <section className={`profile-page ${isJobSeeker ? "" : "personnel-profile-page"}`}>
      {isJobSeeker ? (
        <div className="js-profile-layout">
          <div className="js-profile-hero">
            <div className="js-profile-banner" />
            <div className="js-profile-card">
              <button type="button" className="js-profile-edit" onClick={openEditProfile}>
                Edit
              </button>
              <div className="js-profile-avatar">
                <img src={profileIcon} alt="Profile" />
              </div>
              <div className="js-profile-main">
                <h2>{displayName.toUpperCase()}</h2>
                <div className="js-profile-meta">
                  <span className="js-contact-anchor">
                    <button type="button" className="js-profile-link" onClick={openContactInfo}>
                      Contact Info
                    </button>
                    {isContactOpen && (
                      <div className="js-contact-popover" onClick={(e) => e.stopPropagation()}>
                        <div className="js-contact-head">
                          <strong>Contact Info</strong>
                          <div className="js-contact-head-actions">
                            <button
                              type="button"
                              className="js-contact-edit"
                              onClick={() => setIsEditingContact((prev) => !prev)}
                              title="Edit"
                            >
                              ✎
                            </button>
                            <button type="button" className="js-contact-close" onClick={() => setIsContactOpen(false)}>×</button>
                          </div>
                        </div>
                        {!isEditingContact ? (
                          <div className="js-contact-body">
                            <div className="js-contact-row">
                              <span className="js-contact-icon">in</span>
                              <div>
                                <div className="js-contact-label">Your Profile</div>
                                {contactForm.linkedInUrl ? (
                                  <a className="js-contact-link" href={contactForm.linkedInUrl} target="_blank" rel="noreferrer">
                                    {contactForm.linkedInUrl}
                                  </a>
                                ) : (
                                  <span className="js-contact-muted">No profile link</span>
                                )}
                              </div>
                            </div>
                            <div className="js-contact-row">
                              <span className="js-contact-icon">✉</span>
                              <div>
                                <div className="js-contact-label">Email</div>
                                {contactForm.email ? (
                                  <a className="js-contact-link" href={`mailto:${contactForm.email}`}>
                                    {contactForm.email}
                                  </a>
                                ) : (
                                  <span className="js-contact-muted">No email</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="js-contact-body">
                              <div className="field-group">
                                <label>LinkedIn Profile</label>
                                <input
                                  className="input"
                                  type="text"
                                  value={contactForm.linkedInUrl}
                                  onChange={(e) => setContactForm((prev) => ({ ...prev, linkedInUrl: e.target.value }))}
                                  placeholder="https://linkedin.com/in/your-profile"
                                />
                              </div>
                              <div className="field-group">
                                <label>Email</label>
                                <input
                                  className="input"
                                  type="email"
                                  value={contactForm.email}
                                  onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                                />
                              </div>
                              <div className="field-group">
                                <label>Phone</label>
                                <input
                                  className="input"
                                  type="text"
                                  inputMode="numeric"
                                  value={formatPhoneInputValue(contactForm.phone)}
                                  onChange={(e) => setContactForm((prev) => ({ ...prev, phone: normalizePhoneInput(e.target.value) }))}
                                />
                              </div>
                            </div>
                            <div className="js-contact-actions">
                              <button className="btn btn-small" onClick={saveContactInfo}>Save</button>
                              <button className="btn btn-secondary btn-small" onClick={() => setIsEditingContact(false)}>Cancel</button>
                            </div>
                          </>
                        )}
                        {saveStatus && <div className="js-contact-status">{saveStatus}</div>}
                      </div>
                    )}
                  </span>
                </div>
                <div className="js-profile-unique-id">
                  <span>Unique ID</span>
                  <strong>{uniqueId}</strong>
                </div>
                <div className="js-profile-quick-details">
                  <div>
                    <span>Email</span>
                    <strong>{email}</strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{phone}</strong>
                  </div>
                  <div>
                    <span>Address</span>
                    <strong>{address || "-"}</strong>
                  </div>
                  <div>
                    <span>Created</span>
                    <strong>{createdAt}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="js-profile-sections">
            {isJobSeeker && (
              <div className="js-profile-status">
                {isLoadingProfile && <span className="muted">Loading profile...</span>}
                {!isLoadingProfile && profileError && <span className="muted">{profileError}</span>}
              </div>
            )}

            <section className="js-profile-panel js-profile-pds-panel" ref={resumeSectionRef}>
              <div className="js-panel-header">
                <div>
                  <h3>Personal Data Sheet(PDS)</h3>
                  <p className="js-panel-subtitle">Upload a Personal Data Sheet(PDS) to reuse for job applications</p>
                </div>
              </div>
              <div className={`js-resume-body ${resumeAttentionActive && !jobSeekerResume ? "attention" : ""}`}>
                <input
                  id="job-seeker-resume"
                  ref={resumeInputRef}
                  className="hidden-file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleResumeUpload(e.target.files?.[0] || null)}
                />
                <div className={`js-panel-subtext ${jobSeekerResume ? "js-supporting-ready" : "js-supporting-missing"}`}>
                  {jobSeekerResume
                    ? "Personal Data Sheet(PDS) is uploaded and ready for applications."
                    : "Upload Personal Data Sheet(PDS) before applying to jobs."}
                </div>
                {jobSeekerResume ? (
                  <>
                    <div className="js-panel-row">
                      <div className="js-panel-icon">PDS</div>
                      <div>
                        <strong>{jobSeekerResume.name}</strong>
                        <div className="js-panel-subtext">
                          {resumeUpdatedAt ? `Updated ${resumeUpdatedAt}` : "Personal Data Sheet(PDS) on file"}
                        </div>
                        <div className="js-panel-actions">
                          <label htmlFor="job-seeker-resume" className="js-text-btn">Replace</label>
                          <button type="button" className="js-text-btn danger" onClick={() => setConfirmDeleteResume(true)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="js-panel-row">
                      <div className="js-panel-icon">PDS</div>
                      <div>
                        <strong>No Personal Data Sheet(PDS) uploaded</strong>
                        <div className="js-panel-subtext">Upload your Personal Data Sheet(PDS) to speed up applications.</div>
                      </div>
                    </div>
                    <label htmlFor="job-seeker-resume" className="js-outline-btn">Upload Personal Data Sheet(PDS)</label>
                  </>
                )}
                {resumeStatus && <span className="js-resume-status">{resumeStatus}</span>}
              </div>
            </section>

            <section className="js-profile-panel js-profile-supporting-panel">
              <div className="js-panel-header">
                <div>
                  <h3>Supporting Documents</h3>
                  <p className="js-panel-subtitle">Saved documents are auto-used when you apply</p>
                </div>
              </div>
              <div className="js-resume-body">
                <input
                  ref={supportingInputRef}
                  className="hidden-file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                  onChange={(e) => {
                    handleSupportingUpload(e.target.files)
                    e.target.value = ""
                  }}
                />
                <div className={`js-panel-subtext ${supportingComplete ? "js-supporting-ready" : "js-supporting-missing"}`}>
                  {supportingComplete
                    ? "All required supporting document types are uploaded."
                    : "Upload Certificate, Portfolio, and Transcript."}
                </div>
                {supportingTypeConfig.map((typeConfig) => {
                  const docs = supportingByType[typeConfig.key] || []
                  return (
                    <div key={typeConfig.key} className="js-supporting-group">
                      <div className="js-supporting-group-head">
                        <strong>{typeConfig.label}</strong>
                        <button
                          type="button"
                          className="js-text-btn"
                          onClick={() => openSupportingUpload(typeConfig.key)}
                        >
                          {typeConfig.key === "others"
                            ? (docs.length ? "Add More" : "Upload")
                            : (docs.length ? "Replace" : "Upload")}
                        </button>
                      </div>
                      {docs.length ? (
                        docs.map((doc) => (
                          <div key={doc.id} className="js-panel-row js-panel-row-compact">
                            <div className="js-panel-icon">📄</div>
                            <div>
                              <strong>{doc.originalName || "Supporting document"}</strong>
                              <div className="js-panel-subtext">
                                {doc.uploadedAt
                                  ? `Uploaded ${new Date(doc.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                                  : "Uploaded"}
                              </div>
                              <div className="js-panel-actions">
                                <button type="button" className="js-text-btn danger" onClick={() => setConfirmDeleteSupportingId(doc.id)}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="js-panel-subtext">No {typeConfig.label.toLowerCase()} uploaded.</div>
                      )}
                    </div>
                  )
                })}
                {supportingStatus && <span className="js-resume-status">{supportingStatus}</span>}
              </div>
            </section>

            <section className="js-profile-panel js-profile-eligibility-panel">
              <div className="js-panel-header">
                <div>
                  <h3>Board / Civil Eligibility</h3>
                  <p className="js-panel-subtitle">Add verified eligibility or board rating certificates</p>
                </div>
                <button
                  type="button"
                  className="js-icon-btn"
                  title="Add"
                  onClick={() => {
                    setEligibilityForm({ classification: "", file: null })
                    setEligibilityStatus("")
                    setInvalidFields([])
                    setIsEligibilityModalOpen(true)
                  }}
                >
                  ✎
                </button>
              </div>
              {eligibilityDocs.length ? (
                eligibilityDocs.map((doc) => (
                  <div key={doc.id} className="js-panel-row">
                    <div className="js-panel-icon">EL</div>
                    <div>
                      <strong>{eligibilityClassificationFromType(doc.type)}</strong>
                      <div className="js-panel-subtext">{doc.originalName || "Eligibility certificate"}</div>
                      <div className="js-panel-subtext">
                        {doc.uploadedAt
                          ? `Uploaded ${new Date(doc.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                          : "Uploaded"}
                      </div>
                      <div className="js-panel-actions">
                        <button type="button" className="js-text-btn danger" onClick={() => setConfirmDeleteSupportingId(doc.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="js-panel-row">
                  <div className="js-panel-icon">EL</div>
                  <div className="js-panel-subtext">No eligibility record added yet.</div>
                </div>
              )}
              <button
                type="button"
                className="js-outline-btn"
                onClick={() => {
                  setEligibilityForm({ classification: "", file: null })
                  setEligibilityStatus("")
                  setInvalidFields([])
                  setIsEligibilityModalOpen(true)
                }}
              >
                Add Eligibility
              </button>
            </section>

            <section className="js-profile-panel js-profile-education-panel">
              <div className="js-panel-header">
                <div>
                  <h3>Education</h3>
                  <p className="js-panel-subtitle">Show your qualifications</p>
                </div>
                <button type="button" className="js-icon-btn" title="Edit" onClick={() => openEditEducation()}>✎</button>
              </div>
              {education.length ? (
                education.map((item) => (
                  <div key={item.id} className="js-panel-row">
                    <div className="js-panel-icon">🎓</div>
                    <div>
                      <strong>{item.schoolName || "-"}</strong>
                      <div className="js-panel-subtext">{item.degree || "-"}</div>
                      <div className="js-panel-subtext">
                        {[item.startYear, item.endYear].filter(Boolean).join(" - ") || "-"}
                      </div>
                      {item.description ? (
                        <div className="js-panel-subtext academic-description-lines">
                          {String(item.description).split(/\r?\n/).map((line, index) => (
                            <span key={`${line}-${index}`}>{line}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="js-panel-actions">
                        <button type="button" className="js-text-btn" onClick={() => openEditEducation(item)}>Edit</button>
                        <button type="button" className="js-text-btn danger" onClick={() => deleteEducation(item.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="js-panel-row">
                  <div className="js-panel-icon">🎓</div>
                  <div className="js-panel-subtext">No education added yet.</div>
                </div>
              )}
              <button type="button" className="js-outline-btn" onClick={() => openEditEducation()}>Add Education</button>
            </section>

            <section className="js-profile-panel js-profile-work-panel">
              <div className="js-panel-header">
                <div>
                  <h3>Job Experience</h3>
                  <p className="js-panel-subtitle">Show your work history</p>
                </div>
                <button type="button" className="js-icon-btn" title="Edit" onClick={() => openEditWorkExperience()}>✎</button>
              </div>
              {workExperience.length ? (
                workExperience.map((item) => (
                  <div key={item.id} className="js-panel-row">
                    <div className="js-panel-icon">👤</div>
                    <div>
                      <strong>{item.position || "-"}</strong>
                      <div className="js-panel-subtext">{item.companyName || "-"}</div>
                      <div className="js-panel-subtext">
                        {[item.startDate, item.endDate].filter(Boolean).join(" - ") || "-"}
                      </div>
                      {item.description ? (
                        <div className="js-panel-subtext academic-description-lines">
                          {visibleDescriptionLines(item.description).map((line, index) => (
                            <span key={`${line}-${index}`}>{line}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="js-panel-actions">
                        <button type="button" className="js-text-btn" onClick={() => openEditWorkExperience(item)}>Edit</button>
                        <button type="button" className="js-text-btn danger" onClick={() => deleteExperience(item.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="js-panel-row">
                  <div className="js-panel-icon">👤</div>
                  <div className="js-panel-subtext">No job experience added yet.</div>
                </div>
              )}
              <button type="button" className="js-outline-btn" onClick={() => openEditWorkExperience()}>Add Job Experience</button>
            </section>

            <section className="js-profile-panel js-profile-training-panel">
              <div className="js-panel-header">
                <div>
                  <h3>Learning &amp; Development (Trainings Attended)</h3>
                  <p className="js-panel-subtitle">Show trainings, seminars, and development programs</p>
                </div>
                <button type="button" className="js-icon-btn" title="Edit" onClick={() => openEditTraining()}>✎</button>
              </div>
              {trainingExperience.length ? (
                trainingExperience.map((item) => (
                  <div key={item.id} className="js-panel-row">
                    <div className="js-panel-icon">LD</div>
                    <div>
                      <strong>{item.position || "-"}</strong>
                      <div className="js-panel-subtext">{item.companyName || "-"}</div>
                      <div className="js-panel-subtext">
                        {[item.startDate, item.endDate].filter(Boolean).join(" - ") || "-"}
                      </div>
                      {item.description ? (
                        <div className="js-panel-subtext academic-description-lines">
                          {visibleDescriptionLines(item.description).map((line, index) => (
                            <span key={`${line}-${index}`}>{line}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="js-panel-actions">
                        <button type="button" className="js-text-btn" onClick={() => openEditTraining(item)}>Edit</button>
                        <button type="button" className="js-text-btn danger" onClick={() => deleteExperience(item.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="js-panel-row">
                  <div className="js-panel-icon">LD</div>
                  <div className="js-panel-subtext">No learning and development records added yet.</div>
                </div>
              )}
              <button type="button" className="js-outline-btn" onClick={() => openEditTraining()}>Add Training</button>
            </section>
          </div>
        </div>
      ) : (
        <div className="js-profile-layout personnel-profile-layout">
          <div className="js-profile-hero">
            <div className="js-profile-banner" />
            <div className="js-profile-card">
              <div className="js-profile-avatar">
                <img src={profileIcon} alt="Profile" />
              </div>
              <div className="js-profile-main">
                <h2>{displayName}</h2>
                <div className="js-profile-meta">
                  <span>{roleLabel}</span>
                  <span>{email}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="js-profile-sections personnel-profile-sections">
            <section className="js-profile-panel">
              <div className="js-panel-header">
                <div>
                  <h3>Personal Information</h3>
                  <p className="js-panel-subtitle">Manage your personnel account details</p>
                </div>
                <button type="button" className="js-icon-btn" title="Edit" onClick={openEditProfile}>✎</button>
              </div>
              <div className="personnel-info-grid">
                <div>
                  <span>Name</span>
                  <strong>{displayName}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{email}</strong>
                </div>
                <div>
                  <span>Username</span>
                  <strong>{username}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{phone}</strong>
                </div>
                {isEmployerProfile && (
                  <>
                    <div>
                      <span>ID Number</span>
                      <strong>{personnelIdNumber}</strong>
                    </div>
                  </>
                )}
                <div>
                  <span>Role</span>
                  <strong>{roleLabel}</strong>
                </div>
                <div>
                  <span>Date Created</span>
                  <strong>{createdAt}</strong>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {editMode && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className={`modal-card modal-modern js-edit-modal${editMode === "education" || editMode === "experience" ? " academic-edit-modal" : ""}${!isJobSeeker && editMode === "profile" ? " personnel-edit-modal" : ""}`} onClick={(e) => e.stopPropagation()}>
            {saveStatus && (
              <div className={profileStatusToastClass(saveStatus)} role="status" aria-live="polite">
                {saveStatus}
              </div>
            )}
            <div className="modal-header">
              <h3>{editMode === "education" ? `${editingItem ? "Edit" : "Add"} Education` : editMode === "experience" ? `${editingItem ? "Edit" : "Add"} ${formState.experienceCategory === "work" ? "Job Experience" : "Training"}` : `Edit ${editMode === "profile" ? "Profile" : "About"}`}</h3>
              <button type="button" className="close-x" onClick={closeEdit}>×</button>
            </div>
            {editMode === "profile" && (
              isJobSeeker ? (
                <div className="js-edit-body">
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Full Name</label>
                      <input className="input" value={formState.fullName} onChange={(e) => setFormState((prev) => ({ ...prev, fullName: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <label>Username</label>
                      <input className="input" value={formState.username} onChange={(e) => setFormState((prev) => ({ ...prev, username: e.target.value }))} />
                    </div>
                  </div>
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Email</label>
                      <input className="input" value={formState.email} onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <label>Phone</label>
                      <input
                        className="input"
                        inputMode="numeric"
                        value={formatPhoneInputValue(formState.phone)}
                        onChange={(e) => setFormState((prev) => ({ ...prev, phone: normalizePhoneInput(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Address</label>
                      <input className="input" value={formState.address} onChange={(e) => setFormState((prev) => ({ ...prev, address: e.target.value }))} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="js-edit-body personnel-edit-body">
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Name</label>
                      <input className="input" value={formState.fullName} onChange={(e) => setFormState((prev) => ({ ...prev, fullName: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <label>Email</label>
                      <input className="input" value={formState.email} onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))} />
                    </div>
                  </div>
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Username</label>
                      <input className="input" value={formState.username} onChange={(e) => setFormState((prev) => ({ ...prev, username: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <label>Phone Number</label>
                      <input
                        className="input"
                        inputMode="numeric"
                        value={formatPhoneInputValue(formState.phone)}
                        onChange={(e) => setFormState((prev) => ({ ...prev, phone: normalizePhoneInput(e.target.value) }))}
                      />
                    </div>
                  </div>
                  {isEmployerProfile && (
                    <div className="modal-grid">
                      <div className="field-group">
                        <label>ID Number</label>
                        <input className="input" value={formState.idNumber || ""} onChange={(e) => setFormState((prev) => ({ ...prev, idNumber: e.target.value }))} />
                      </div>
                    </div>
                  )}
                  <div className="modal-grid">
                    <div className="field-group">
                      <label>New Password</label>
                      <input
                        className="input"
                        type="password"
                        placeholder="Leave blank to keep current password"
                        value={formState.password}
                        onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
                      />
                    </div>
                    <div className="field-group">
                      <label>Confirm Password</label>
                      <input
                        className="input"
                        type="password"
                        placeholder="Repeat new password"
                        value={formState.confirmPassword}
                        onChange={(e) => setFormState((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )
            )}
            {editMode === "about" && (
              <div className="js-edit-body">
                <div className="field-group">
                  <label>About</label>
                  <textarea className="input" rows={6} value={formState.aboutText} onChange={(e) => setFormState((prev) => ({ ...prev, aboutText: e.target.value }))} />
                </div>
              </div>
            )}
            {editMode === "education" && (
              <div className="js-edit-body academic-block-form">
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Educational Level</label>
                    <select className={inputClass("educationLevel")} value={formState.educationLevel || ""} onChange={(e) => setFormState((prev) => ({ ...prev, educationLevel: e.target.value }))}>
                      <option value="">Select level</option>
                      {educationLevelOptions.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Graduation Status</label>
                    <select className={inputClass("graduationStatus")} value={formState.graduationStatus || ""} onChange={(e) => setFormState((prev) => ({ ...prev, graduationStatus: e.target.value }))}>
                      <option value="">Select status</option>
                      {graduationStatusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-group">
                  <label>School Name <span className="academic-label-note">Use complete school name</span></label>
                  <input className={inputClass("schoolName")} value={formState.schoolName || ""} onChange={(e) => setFormState((prev) => ({ ...prev, schoolName: e.target.value }))} />
                </div>
                <div className="field-group">
                  <label>Degree / Course <span className="academic-label-note">Spell out the full course</span></label>
                  <input className={inputClass("degree")} value={formState.degree || ""} onChange={(e) => setFormState((prev) => ({ ...prev, degree: e.target.value }))} />
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>From Year</label>
                    <select className={inputClass("startYear")} value={formState.startYear || ""} onChange={(e) => setFormState((prev) => ({ ...prev, startYear: e.target.value }))}>
                      <option value="">Select year</option>
                      {academicYearOptions.map((year) => (
                        <option key={`from-${year}`} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>To Year</label>
                    <select className={inputClass("endYear")} value={formState.endYear || ""} onChange={(e) => setFormState((prev) => ({ ...prev, endYear: e.target.value }))}>
                      <option value="">Select year</option>
                      {academicYearOptions.map((year) => (
                        <option key={`to-${year}`} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-group academic-year-graduated">
                  <label>Year Graduated</label>
                  <select className={inputClass("yearGraduated")} value={formState.yearGraduated || ""} onChange={(e) => setFormState((prev) => ({ ...prev, yearGraduated: e.target.value }))}>
                    <option value="">Select graduation year</option>
                    {academicYearOptions.map((year) => (
                      <option key={`grad-${year}`} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>Academic Honors / Awards Received</label>
                  <textarea
                    className={inputClass("academicHonors", "input academic-textarea")}
                    rows={2}
                    disabled={Boolean(formState.honorsNotApplicable)}
                    value={formState.honorsNotApplicable ? "" : (formState.academicHonors || "")}
                    onChange={(e) => setFormState((prev) => ({ ...prev, academicHonors: e.target.value }))}
                  />
                  <label className="academic-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(formState.honorsNotApplicable)}
                      onChange={(e) => setFormState((prev) => ({ ...prev, honorsNotApplicable: e.target.checked }))}
                    />
                    <span>Not Applicable (N/A)</span>
                  </label>
                </div>
              </div>
            )}
            {editMode === "experience" && formState.experienceCategory === "work" && (
              <div className="js-edit-body work-experience-form">
                <div className="field-group">
                  <label>Position Title</label>
                  <input className={inputClass("position")} value={formState.position || ""} onChange={(e) => setFormState((prev) => ({ ...prev, position: e.target.value }))} />
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Start Date</label>
                    <input type="date" className={inputClass("startDate")} value={formState.startDate || ""} onChange={(e) => setFormState((prev) => ({ ...prev, startDate: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      className={inputClass("endDate")}
                      disabled={formState.endDate === "Present"}
                      value={formState.endDate === "Present" ? "" : (formState.endDate || "")}
                      onChange={(e) => setFormState((prev) => ({ ...prev, endDate: e.target.value }))}
                    />
                    <label className="academic-checkbox experience-present-check">
                      <input
                        type="checkbox"
                        checked={formState.endDate === "Present"}
                        onChange={(e) => setFormState((prev) => ({ ...prev, endDate: e.target.checked ? "Present" : "" }))}
                      />
                      <span>Present</span>
                    </label>
                  </div>
                </div>
                <div className="field-group">
                  <label>Department / Agency / Corporate Office Company Name</label>
                  <input className={inputClass("companyName")} value={formState.companyName || ""} onChange={(e) => setFormState((prev) => ({ ...prev, companyName: e.target.value }))} />
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Government Service</label>
                    <select className={inputClass("governmentService")} value={formState.governmentService || ""} onChange={(e) => setFormState((prev) => ({ ...prev, governmentService: e.target.value }))}>
                      <option value="">Select option</option>
                      {governmentServiceOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Monthly Gross Salary</label>
                    <input className={inputClass("monthlySalary")} inputMode="decimal" placeholder="0.00" value={formState.monthlySalary || ""} onChange={(e) => setFormState((prev) => ({ ...prev, monthlySalary: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Salary Grade (SG)</label>
                    <span className="academic-label-note">If applicable</span>
                    <input className="input" placeholder="Leave empty if private" value={formState.salaryGrade || ""} onChange={(e) => setFormState((prev) => ({ ...prev, salaryGrade: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>Status of Appointment</label>
                    <select className={inputClass("appointmentStatus")} value={formState.appointmentStatus || ""} onChange={(e) => setFormState((prev) => ({ ...prev, appointmentStatus: e.target.value }))}>
                      <option value="">Select status</option>
                      {appointmentStatusOptions.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>{statusOption}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-group">
                  <label>Certificate of Employment (COE) <span className="academic-label-note">PDF, JPG, or PNG</span></label>
                  <input
                    type="file"
                    className={inputClass("coeFile", "input training-file-input")}
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => setFormState((prev) => ({ ...prev, coeFile: e.target.files?.[0] || null }))}
                  />
                  {(formState.coeFile?.name || formState.coeFileName) && (
                    <div className="js-panel-subtext training-file-name">
                      {formState.coeFile?.name || formState.coeFileName}
                    </div>
                  )}
                </div>
              </div>
            )}
            {editMode === "experience" && formState.experienceCategory !== "work" && (
              <div className="js-edit-body training-block-form">
                <div className="field-group">
                  <label>Training Program / Course Title</label>
                  <input className={inputClass("position")} value={formState.position || ""} onChange={(e) => setFormState((prev) => ({ ...prev, position: e.target.value }))} />
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Start Date</label>
                    <input type="date" className={inputClass("startDate")} value={formState.startDate || ""} onChange={(e) => setFormState((prev) => ({ ...prev, startDate: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>End Date</label>
                    <input type="date" className={inputClass("endDate")} value={formState.endDate || ""} onChange={(e) => setFormState((prev) => ({ ...prev, endDate: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Number of Hours Credit</label>
                    <input
                      className={inputClass("trainingHours")}
                      inputMode="decimal"
                      placeholder="e.g. 40"
                      value={formState.trainingHours || ""}
                      onChange={(e) => setFormState((prev) => ({ ...prev, trainingHours: e.target.value }))}
                    />
                  </div>
                  <div className="field-group">
                    <label>LD Classification</label>
                    <select className={inputClass("ldClassification")} value={formState.ldClassification || ""} onChange={(e) => setFormState((prev) => ({ ...prev, ldClassification: e.target.value }))}>
                      <option value="">Select classification</option>
                      {ldClassificationOptions.map((classification) => (
                        <option key={classification} value={classification}>{classification}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-group">
                  <label>Conducted / Sponsored By</label>
                  <input className={inputClass("companyName")} value={formState.companyName || ""} onChange={(e) => setFormState((prev) => ({ ...prev, companyName: e.target.value }))} />
                </div>
                <div className="field-group">
                  <label>Certificate of Training <span className="academic-label-note">PDF, JPG, or PNG</span></label>
                  <input
                    type="file"
                    className={inputClass("trainingCertificateFile", "input training-file-input")}
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => setFormState((prev) => ({ ...prev, trainingCertificateFile: e.target.files?.[0] || null }))}
                  />
                  {(formState.trainingCertificateFile?.name || formState.trainingCertificateName) && (
                    <div className="js-panel-subtext training-file-name">
                      {formState.trainingCertificateFile?.name || formState.trainingCertificateName}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => {
                  if (editMode === "profile" && !isJobSeeker) setConfirmSavePersonnelProfile(true)
                  else if (editMode === "profile") saveProfile()
                  else if (editMode === "about") saveProfile()
                  else if (editMode === "education") requestEducationSave()
                  else if (editMode === "experience") requestExperienceSave()
                }}
              >
                Save
              </button>
              <button className="btn btn-secondary" onClick={closeEdit}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {confirmSavePersonnelProfile && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmSavePersonnelProfile(false)
            }
          }}
        >
          <div className="modal-card">
            <h3>Save Profile Changes</h3>
            <p>Are you sure you want to save these personnel profile changes?</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmSavePersonnelProfile(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setConfirmSavePersonnelProfile(false)
                  saveProfile()
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmSaveAction && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmSaveAction(null)
            }
          }}
        >
          <div className="modal-card">
            <h3>{confirmSaveAction.title}</h3>
            <p>{confirmSaveAction.message}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmSaveAction(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const actionType = confirmSaveAction.type
                  setConfirmSaveAction(null)
                  if (actionType === "education") {
                    saveEducation()
                  } else if (actionType === "experience") {
                    saveExperience()
                  } else if (actionType === "eligibility") {
                    handleEligibilitySubmit()
                  }
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isEligibilityModalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsEligibilityModalOpen(false)
              setEligibilityStatus("")
              setInvalidFields([])
            }
          }}
        >
          <div className="modal-card modal-modern js-edit-modal" onClick={(e) => e.stopPropagation()}>
            {eligibilityStatus && (
              <div className={profileStatusToastClass(eligibilityStatus)} role="status" aria-live="polite">
                {eligibilityStatus}
              </div>
            )}
            <div className="modal-header">
              <h3>Add Board / Civil Eligibility</h3>
              <button
                type="button"
                className="close-x"
                onClick={() => {
                  setIsEligibilityModalOpen(false)
                  setEligibilityStatus("")
                  setInvalidFields([])
                }}
              >
                ×
              </button>
            </div>
            <div className="js-edit-body">
              <div className="field-group">
                <label>Eligibility Type Classification</label>
                <select
                  className={inputClass("eligibilityClassification")}
                  value={eligibilityForm.classification}
                  onChange={(e) => setEligibilityForm((prev) => ({ ...prev, classification: e.target.value }))}
                >
                  <option value="">Select verified designation</option>
                  {eligibilityClassificationOptions.map((classification) => (
                    <option key={classification} value={classification}>{classification}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label>Certificate of Eligibility / Board Rating Certificate</label>
                <input
                  type="file"
                  className={inputClass("eligibilityFile", "input training-file-input")}
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => setEligibilityForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
                />
                {eligibilityForm.file?.name && (
                  <div className="js-panel-subtext training-file-name">{eligibilityForm.file.name}</div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={requestEligibilitySave}>
                Add Record
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setIsEligibilityModalOpen(false)
                  setEligibilityStatus("")
                  setInvalidFields([])
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteEducationId != null && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmDeleteEducationId(null)
            }
          }}
        >
          <div className="modal-card">
            <h3>Delete Education</h3>
            <p>Are you sure you want to delete this education entry? This action cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDeleteEducationId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  const idToDelete = confirmDeleteEducationId
                  setConfirmDeleteEducationId(null)
                  if (idToDelete != null) {
                    await performDeleteEducation(idToDelete)
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteExperienceId != null && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmDeleteExperienceId(null)
            }
          }}
        >
          <div className="modal-card">
            <h3>Delete {pendingDeleteExperienceIsTraining ? "Training" : "Job Experience"}</h3>
            <p>
              Are you sure you want to delete this {pendingDeleteExperienceIsTraining ? "training" : "job experience"} entry? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDeleteExperienceId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  const idToDelete = confirmDeleteExperienceId
                  setConfirmDeleteExperienceId(null)
                  if (idToDelete != null) {
                    await performDeleteExperience(idToDelete)
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteSupportingId != null && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmDeleteSupportingId(null)
            }
          }}
        >
          <div className="modal-card">
            <h3>Delete {pendingDeleteSupportingIsEligibility ? "Eligibility" : "Supporting Document"}</h3>
            <p>
              Are you sure you want to delete this {pendingDeleteSupportingIsEligibility ? "eligibility record" : "supporting document"}? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDeleteSupportingId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  const idToDelete = confirmDeleteSupportingId
                  setConfirmDeleteSupportingId(null)
                  if (idToDelete != null) {
                    handleSupportingDelete(idToDelete)
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteResume && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmDeleteResume(false)
            }
          }}
        >
          <div className="modal-card">
            <h3>Delete Personal Data Sheet(PDS)</h3>
            <p>Are you sure you want to delete this Personal Data Sheet(PDS)? You can upload a new one after deleting it.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDeleteResume(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  setConfirmDeleteResume(false)
                  await handleResumeDelete()
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {supportingErrorToast && (
        <div className="toast toast-fail">{supportingErrorToast}</div>
      )}


    </section>
  )
}

export default ProfilePage
