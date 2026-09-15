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
    school: "",
    program: "",
    year: "",
    title: "",
    company: ""
  })
  const [editingItem, setEditingItem] = useState(null)
  const [saveStatus, setSaveStatus] = useState("")
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

  const formatJobSeekerUniqueId = (profile) => {
    const explicitId = String(profile?.idNumber || profile?.id_number || "").trim()
    if (explicitId) return explicitId
    const numericId = Number(profile?.id)
    return Number.isFinite(numericId) && numericId > 0 ? `LNU-${String(numericId).padStart(6, "0")}` : "-"
  }

  const displayName = isJobSeeker
    ? (normalizedJobSeekerProfile?.fullName || "Job Seeker")
    : (loginEmail ? loginEmail.split("@")[0] : "User")
  const email = isJobSeeker ? (normalizedJobSeekerProfile?.email || "-") : (loginEmail || "-")
  const uniqueId = isJobSeeker ? formatJobSeekerUniqueId(normalizedJobSeekerProfile) : "-"
  const username = isJobSeeker
    ? (normalizedJobSeekerProfile?.username || "-")
    : (loginEmail ? loginEmail.split("@")[0] : "-")
  const phone = isJobSeeker ? (normalizedJobSeekerProfile?.phone || "-") : "-"
  const status = isJobSeeker ? (normalizedJobSeekerProfile?.status || "-") : "-"
  const createdAt = isJobSeeker && normalizedJobSeekerProfile?.createdAt
    ? new Date(normalizedJobSeekerProfile.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "-"
  const address = isJobSeeker ? (normalizedJobSeekerProfile?.address || normalizedJobSeekerProfile?.location || "") : ""
  const aboutText = isJobSeeker ? (normalizedJobSeekerProfile?.aboutText || "") : ""
  const education = isJobSeeker ? (normalizedJobSeekerProfile?.education || []) : []
  const experience = isJobSeeker ? (normalizedJobSeekerProfile?.experience || []) : []
  const trainingExperience = experience.filter(isTrainingExperience)
  const workExperience = experience.filter((item) => !isTrainingExperience(item))
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
      fullName: displayName === "Job Seeker" ? "" : displayName,
      username: normalizedJobSeekerProfile?.username || "",
      email,
      phone: normalizePhoneInput(normalizedJobSeekerProfile?.phone || ""),
      address: normalizedJobSeekerProfile?.address || "",
      school: "",
      program: "",
      year: "",
      title: "",
      company: ""
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
    setEditMode("experience")
  }

  const closeEdit = () => {
    setEditMode(null)
    setEditingItem(null)
    setSaveStatus("")
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

  const saveEducation = async () => {
    if (!resolvedJobSeekerId) {
      setSaveStatus("Missing job seeker id.")
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
    if (jobSeekerResume) {
      setResumeStatus("Resume/PDS already uploaded and cannot be replaced.")
      if (resumeInputRef.current) {
        resumeInputRef.current.value = ""
      }
      return
    }
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
          throw new Error(payload?.message || "Failed to upload resume.")
        }
        return response.json()
      })
      .then((payload) => {
        onJobSeekerResumeUpdate?.(payload?.resume || null)
        setResumeStatus("Saved.")
        setTimeout(() => setResumeStatus(""), 2000)
      })
      .catch((error) => {
        setResumeStatus(error.message || "Failed to upload resume.")
      })
      .finally(() => {
        if (resumeInputRef.current) {
          resumeInputRef.current.value = ""
        }
      })
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
    if (!resolvedJobSeekerId) {
      setEligibilityStatus("Missing job seeker id.")
      return
    }
    if (!eligibilityForm.classification) {
      setEligibilityStatus("Select an eligibility classification.")
      return
    }
    if (!eligibilityForm.file) {
      setEligibilityStatus("Upload an eligibility certificate.")
      return
    }

    const lowerName = String(eligibilityForm.file.name || "").toLowerCase()
    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg"]
    if (!allowedExtensions.some((extension) => lowerName.endsWith(extension))) {
      setEligibilityStatus("Upload a PDF, PNG, JPG, or JPEG document.")
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
    <section className="profile-page">
      {isJobSeeker ? (
        <div className="js-profile-layout">
          <div className="js-profile-hero">
            <div className="js-profile-banner" />
            <div className="js-profile-card">
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
              <button type="button" className="js-profile-edit" title="Edit" onClick={openEditProfile}>✎</button>
            </div>
          </div>

          <div className="js-profile-sections">
            {isJobSeeker && (
              <div className="js-profile-status">
                {isLoadingProfile && <span className="muted">Loading profile...</span>}
                {!isLoadingProfile && profileError && <span className="muted">{profileError}</span>}
              </div>
            )}

            <section className="js-profile-panel">
              <div className="js-panel-header">
                <h3>About</h3>
                <button type="button" className="js-icon-btn" title="Edit" onClick={openEditAbout}>✎</button>
              </div>
              {aboutText ? (
                <p className="js-panel-text">
                  {aboutText}
                </p>
              ) : (
                <p className="js-panel-text muted">No about information added.</p>
              )}
            </section>

            <section className="js-profile-panel" ref={resumeSectionRef}>
              <div className="js-panel-header">
                <div>
                  <h3>Resume/CV</h3>
                  <p className="js-panel-subtitle">Upload once to reuse for job applications</p>
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
                    ? "Resume/PDS is uploaded and locked for applications."
                    : "Upload Resume/PDS before applying to jobs."}
                </div>
                {jobSeekerResume ? (
                  <>
                    <div className="js-panel-row">
                      <div className="js-panel-icon">CV</div>
                      <div>
                        <strong>{jobSeekerResume.name}</strong>
                        <div className="js-panel-subtext">
                          {resumeUpdatedAt ? `Updated ${resumeUpdatedAt}` : "Resume on file"}
                        </div>
                        <div className="js-panel-subtext">This file cannot be replaced or removed by the job seeker.</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="js-panel-row">
                      <div className="js-panel-icon">CV</div>
                      <div>
                        <strong>No resume uploaded</strong>
                        <div className="js-panel-subtext">Upload your resume or CV to speed up applications.</div>
                      </div>
                    </div>
                    <label htmlFor="job-seeker-resume" className="js-outline-btn">Upload Resume</label>
                  </>
                )}
                {resumeStatus && <span className="js-resume-status">{resumeStatus}</span>}
              </div>
            </section>

            <section className="js-profile-panel">
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

            <section className="js-profile-panel">
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
                  setIsEligibilityModalOpen(true)
                }}
              >
                Add Eligibility
              </button>
            </section>

            <section className="js-profile-panel">
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

            <section className="js-profile-panel">
              <div className="js-panel-header">
                <div>
                  <h3>Experience</h3>
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
                  <div className="js-panel-subtext">No experience added yet.</div>
                </div>
              )}
              <button type="button" className="js-outline-btn" onClick={() => openEditWorkExperience()}>Add Experience</button>
            </section>

            <section className="js-profile-panel">
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
        <>
          <div className="profile-header-card">
            <div className="profile-header-left">
              <div className="profile-avatar">
                <img src={profileIcon} alt="Profile" />
              </div>
              <div className="profile-header-text">
                <h2>{displayName.toUpperCase()}</h2>
                <p className="profile-role">{roleLabel}</p>
                <div className="profile-location">
                  <span className="profile-location-label">Address:</span>
                  <span>{address || "-"}</span>
                </div>
              </div>
            </div>
            <button type="button" className="btn profile-edit-btn">Edit</button>
          </div>

          <section className="profile-card">
            <h3>Personal Information</h3>
            <div className="profile-info-grid">
              <div className="profile-info-row">
                <span>Name:</span>
                <strong>{displayName}</strong>
              </div>
              {isJobSeeker && (
                <div className="profile-info-row">
                  <span>Unique ID:</span>
                  <strong>{uniqueId}</strong>
                </div>
              )}
              <div className="profile-info-row">
                <span>Email:</span>
                <strong>{email}</strong>
              </div>
              <div className="profile-info-row">
                <span>Username:</span>
                <strong>{username}</strong>
              </div>
              <div className="profile-info-row">
                <span>Role:</span>
                <strong>{roleLabel}</strong>
              </div>
              <div className="profile-info-row">
                <span>Date Created:</span>
                <strong>{createdAt}</strong>
              </div>
            </div>
          </section>
        </>
      )}

      {editMode && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className={`modal-card modal-modern js-edit-modal${editMode === "education" || editMode === "experience" ? " academic-edit-modal" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editMode === "education" ? `${editingItem ? "Edit" : "Add"} Education` : editMode === "experience" ? `${editingItem ? "Edit" : "Add"} ${formState.experienceCategory === "work" ? "Experience" : "Training"}` : `Edit ${editMode === "profile" ? "Profile" : "About"}`}</h3>
              <button type="button" className="close-x" onClick={closeEdit}>×</button>
            </div>
            {editMode === "profile" && (
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
                    <select className="input" value={formState.educationLevel || ""} onChange={(e) => setFormState((prev) => ({ ...prev, educationLevel: e.target.value }))}>
                      <option value="">Select level</option>
                      {educationLevelOptions.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Graduation Status</label>
                    <select className="input" value={formState.graduationStatus || ""} onChange={(e) => setFormState((prev) => ({ ...prev, graduationStatus: e.target.value }))}>
                      <option value="">Select status</option>
                      {graduationStatusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-group">
                  <label>School Name <span className="academic-label-note">Use complete school name</span></label>
                  <input className="input" value={formState.schoolName || ""} onChange={(e) => setFormState((prev) => ({ ...prev, schoolName: e.target.value }))} />
                </div>
                <div className="field-group">
                  <label>Degree / Course <span className="academic-label-note">Spell out the full course</span></label>
                  <input className="input" value={formState.degree || ""} onChange={(e) => setFormState((prev) => ({ ...prev, degree: e.target.value }))} />
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>From Year</label>
                    <select className="input" value={formState.startYear || ""} onChange={(e) => setFormState((prev) => ({ ...prev, startYear: e.target.value }))}>
                      <option value="">Select year</option>
                      {academicYearOptions.map((year) => (
                        <option key={`from-${year}`} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>To Year</label>
                    <select className="input" value={formState.endYear || ""} onChange={(e) => setFormState((prev) => ({ ...prev, endYear: e.target.value }))}>
                      <option value="">Select year</option>
                      {academicYearOptions.map((year) => (
                        <option key={`to-${year}`} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-group academic-year-graduated">
                  <label>Year Graduated</label>
                  <select className="input" value={formState.yearGraduated || ""} onChange={(e) => setFormState((prev) => ({ ...prev, yearGraduated: e.target.value }))}>
                    <option value="">Select graduation year</option>
                    {academicYearOptions.map((year) => (
                      <option key={`grad-${year}`} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>Academic Honors / Awards Received</label>
                  <textarea
                    className="input academic-textarea"
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
                  <input className="input" value={formState.position || ""} onChange={(e) => setFormState((prev) => ({ ...prev, position: e.target.value }))} />
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Start Date</label>
                    <input type="date" className="input" value={formState.startDate || ""} onChange={(e) => setFormState((prev) => ({ ...prev, startDate: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      className="input"
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
                  <input className="input" value={formState.companyName || ""} onChange={(e) => setFormState((prev) => ({ ...prev, companyName: e.target.value }))} />
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Government Service</label>
                    <select className="input" value={formState.governmentService || ""} onChange={(e) => setFormState((prev) => ({ ...prev, governmentService: e.target.value }))}>
                      <option value="">Select option</option>
                      {governmentServiceOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Monthly Gross Salary</label>
                    <input className="input" inputMode="decimal" placeholder="0.00" value={formState.monthlySalary || ""} onChange={(e) => setFormState((prev) => ({ ...prev, monthlySalary: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Salary Grade (SG) <span className="academic-label-note">If applicable</span></label>
                    <input className="input" placeholder="Leave empty if private" value={formState.salaryGrade || ""} onChange={(e) => setFormState((prev) => ({ ...prev, salaryGrade: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>Status of Appointment</label>
                    <select className="input" value={formState.appointmentStatus || ""} onChange={(e) => setFormState((prev) => ({ ...prev, appointmentStatus: e.target.value }))}>
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
                    className="input training-file-input"
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
                  <input className="input" value={formState.position || ""} onChange={(e) => setFormState((prev) => ({ ...prev, position: e.target.value }))} />
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Start Date</label>
                    <input type="date" className="input" value={formState.startDate || ""} onChange={(e) => setFormState((prev) => ({ ...prev, startDate: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>End Date</label>
                    <input type="date" className="input" value={formState.endDate || ""} onChange={(e) => setFormState((prev) => ({ ...prev, endDate: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-grid">
                  <div className="field-group">
                    <label>Number of Hours Credit</label>
                    <input
                      className="input"
                      inputMode="decimal"
                      placeholder="e.g. 40"
                      value={formState.trainingHours || ""}
                      onChange={(e) => setFormState((prev) => ({ ...prev, trainingHours: e.target.value }))}
                    />
                  </div>
                  <div className="field-group">
                    <label>LD Classification</label>
                    <select className="input" value={formState.ldClassification || ""} onChange={(e) => setFormState((prev) => ({ ...prev, ldClassification: e.target.value }))}>
                      <option value="">Select classification</option>
                      {ldClassificationOptions.map((classification) => (
                        <option key={classification} value={classification}>{classification}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-group">
                  <label>Conducted / Sponsored By</label>
                  <input className="input" value={formState.companyName || ""} onChange={(e) => setFormState((prev) => ({ ...prev, companyName: e.target.value }))} />
                </div>
                <div className="field-group">
                  <label>Certificate of Training <span className="academic-label-note">PDF, JPG, or PNG</span></label>
                  <input
                    type="file"
                    className="input training-file-input"
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
                  if (editMode === "profile") saveProfile()
                  else if (editMode === "about") saveProfile()
                  else if (editMode === "education") saveEducation()
                  else if (editMode === "experience") saveExperience()
                }}
              >
                Save
              </button>
              <button className="btn btn-secondary" onClick={closeEdit}>Cancel</button>
              {saveStatus && <span className="muted">{saveStatus}</span>}
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
            }
          }}
        >
          <div className="modal-card modal-modern js-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Board / Civil Eligibility</h3>
              <button
                type="button"
                className="close-x"
                onClick={() => {
                  setIsEligibilityModalOpen(false)
                  setEligibilityStatus("")
                }}
              >
                ×
              </button>
            </div>
            <div className="js-edit-body">
              <div className="field-group">
                <label>Eligibility Type Classification</label>
                <select
                  className="input"
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
                  className="input training-file-input"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => setEligibilityForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
                />
                {eligibilityForm.file?.name && (
                  <div className="js-panel-subtext training-file-name">{eligibilityForm.file.name}</div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={handleEligibilitySubmit}>
                Add Record
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  setIsEligibilityModalOpen(false)
                  setEligibilityStatus("")
                }}
              >
                Cancel
              </button>
              {eligibilityStatus && <span className="muted">{eligibilityStatus}</span>}
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
            <h3>Delete Experience</h3>
            <p>Are you sure you want to delete this experience entry? This action cannot be undone.</p>
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
            <h3>Delete Supporting Document</h3>
            <p>Are you sure you want to delete this supporting document? This action cannot be undone.</p>
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

      {supportingErrorToast && (
        <div className="toast toast-fail">{supportingErrorToast}</div>
      )}


    </section>
  )
}

export default ProfilePage
