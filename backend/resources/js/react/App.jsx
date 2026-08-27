import React from 'react'
// React imports
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './layouts/AppLayout.css'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import ApplicantViewPage from './pages/ApplicantViewPage'
import JobPostingPage from './pages/JobPostingPage'
import DashboardPage from './pages/DashboardPage'
import JobSeekerDashboard from './pages/JobSeekerDashboard'
import JobViewPage from './pages/JobViewPage'
import ProfilePage from './pages/ProfilePage'
import UsersPage from './pages/UsersPage'
import RegisterPage from './pages/RegisterPage'
import RatingsPage from './pages/RatingsPage'
import HelpPage from './pages/HelpPage'
import ArchivePage from './pages/ArchivePage'
import CustomDropdown from './components/CustomDropdown'
import { getArchiveActorHeaders } from './utils/archiveActor'
import profileIcon from './assets/circle-user-solid-full.svg'
import bellIcon from './assets/bell-solid-full.svg'
import brandLogo from './assets/Logo.png'
import './layouts/SidebarLayout.css'
import html2canvas from "html2canvas"
import { jsPDF } from "jspdf"

const jobSeekerPageIntros = {
  dashboard: {
    title: "Dashboard",
    body: "This is where you track applications you submitted, see dates applied, check status, and review qualification results.",
    tips: [
      "Use Applied Jobs to view or remove your submitted applications.",
      "Check the overview cards to understand your application results."
    ]
  },
  jobs: {
    title: "Jobs",
    body: "This page lists available job openings. Open a job to read its details, then apply using your saved resume and supporting documents.",
    tips: [
      "Upload your resume in Profile before applying.",
      "Use job details to confirm the position fits your skills."
    ]
  },
  profile: {
    title: "Profile",
    body: "This is your setup page. Add your phone number, address, education, experience, resume, and supporting documents here.",
    tips: [
      "Use Edit Profile to add phone number and address.",
      "Upload resume, certificates, portfolio, application letter, and transcript."
    ]
  },
  help: {
    title: "Help",
    body: "This page keeps the setup walkthrough and page guide available whenever you need a reminder.",
    tips: [
      "Open the setup guide again from here.",
      "Use the page guide to learn what each job seeker page does."
    ]
  }
}

const jobSeekerSetupGuideSteps = [
  {
    page: "profile",
    title: "Open Profile",
    body: "Start in Profile and review your basic account information.",
    detail: "This is where your job seeker identity lives before you apply to any job."
  },
  {
    page: "profile",
    title: "Add Contact Details",
    body: "Add your phone number, address, about section, education, and work experience.",
    detail: "Complete profile details help applications look ready and make your information easier to review."
  },
  {
    page: "profile",
    title: "Upload Resume",
    body: "Save one resume so job applications can use it automatically.",
    detail: "The system uses your resume for matching and application submission."
  },
  {
    page: "profile",
    title: "Add Documents",
    body: "Upload certificates, portfolio, application letter, transcript, and other supporting files.",
    detail: "Supporting documents are saved once and reused when you apply."
  },
  {
    page: "jobs",
    title: "Browse Jobs",
    body: "Open Jobs, view available positions, and check each job's details.",
    detail: "Read the requirements first, then apply when your resume and documents are ready."
  },
  {
    page: "dashboard",
    title: "Track Applications",
    body: "Return to Dashboard to monitor submitted applications and qualification results.",
    detail: "Dashboard is your home base after you start applying."
  }
]

function parseSkills(skillsText) {
  const value = Array.isArray(skillsText)
    ? skillsText.join(",")
    : typeof skillsText === "string"
      ? skillsText
      : skillsText == null
        ? ""
        : String(skillsText)

  const normalized = value.trim()
  if (!normalized) return []

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    try {
      const parsed = JSON.parse(normalized)
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean)
      }
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return normalized
    .split(/[,;\n|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseMissingSkills(skillsText) {
  const value = Array.isArray(skillsText)
    ? skillsText.join(",")
    : typeof skillsText === "string"
      ? skillsText
      : skillsText == null
        ? ""
        : String(skillsText)

  const normalized = value.trim()
  if (!normalized) return []

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    try {
      const parsed = JSON.parse(normalized)
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean)
      }
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return normalized
    .split(/[,;\n|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeEducationItem(item = {}) {
  return {
    id: item?.id ?? null,
    schoolName: item?.schoolName || item?.school_name || item?.school || "",
    degree: item?.degree || item?.program || "",
    startYear: item?.startYear || item?.start_year || "",
    endYear: item?.endYear || item?.end_year || "",
    description: item?.description || "",
  }
}

function normalizeExperienceItem(item = {}) {
  return {
    id: item?.id ?? null,
    companyName: item?.companyName || item?.company_name || item?.company || "",
    position: item?.position || item?.title || "",
    startDate: item?.startDate || item?.start_date || "",
    endDate: item?.endDate || item?.end_date || "",
    description: item?.description || "",
  }
}

function extractEducationLines(text) {
  const source = (text || "").replace(/\r/g, "\n")
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const directMatches = lines
    .filter((line) => /(university|college|school|institute|academy)/i.test(line))
    .slice(0, 6)

  if (directMatches.length) {
    return directMatches
  }

  const compact = source.replace(/\s+/g, " ").trim()
  const chunks = compact
    .split(/(?=\b(?:elementary|high school|college|university|institute|academy|bachelor|master|phd|associate)\b)/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /(school|college|university|institute|academy|bachelor|master|phd|associate)/i.test(chunk))
    .map((chunk) => chunk.replace(/\s*(work history|experience|skills|summary)\b.*/i, "").trim())
    .filter(Boolean)

  return Array.from(new Set(chunks)).slice(0, 6)
}

function extractExperienceLines(text) {
  const source = (text || "").replace(/\r/g, "\n")
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const experienceHeaderPattern = /^(work\s+experience|professional\s+experience|employment|employment\s+history|work\s+history|experience)\s*:?\s*$/i
  const stopHeaderPattern = /^(education|skills?|projects?|certifications?|summary|profile|references)\s*:?\s*$/i
  const dateRangePattern = /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|\d{4})\s*(?:-|–|to)\s*(?:present|current|now|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|\d{4}))\b/i
  const titlePattern = /\b(?:software|frontend|front-end|backend|full[-\s]?stack|web|mobile|qa|test|data|product|project|systems?)?\s*(?:engineer|developer|analyst|manager|lead|specialist|consultant|intern|assistant|architect|administrator|officer|designer)\b/i
  const companyPattern = /\b(?:at|with)\s+[A-Z][A-Za-z0-9&.,\- ]{1,80}\b|\b[A-Z][A-Za-z0-9&.,\- ]+\s(?:inc\.?|corp\.?|llc|ltd)\b/i
  const yearsPattern = /\d+\+?\s*years?/i
  const bulletActionPattern = /^(created|developed|implemented|designed|optimized|built|improved|maintained|led|managed|automated|deployed|integrated)\b/i

  const sectionLines = []
  let inExperienceSection = false
  for (const line of lines) {
    if (experienceHeaderPattern.test(line)) {
      inExperienceSection = true
      continue
    }
    if (stopHeaderPattern.test(line)) {
      inExperienceSection = false
      continue
    }
    if (inExperienceSection) {
      sectionLines.push(line)
    }
  }

  const pool = sectionLines.length ? sectionLines : lines
  const results = []
  const seen = new Set()

  for (let i = 0; i < pool.length; i += 1) {
    const line = pool[i]
    const isAnchor = dateRangePattern.test(line) || titlePattern.test(line) || companyPattern.test(line) || yearsPattern.test(line)
    if (!isAnchor || line.length < 8) continue

    let entry = line
    const next = pool[i + 1]
    if (next && bulletActionPattern.test(next) && next.length > 12) {
      entry = `${entry} | ${next}`
      i += 1
    }

    const normalized = entry.toLowerCase()
    if (!seen.has(normalized)) {
      seen.add(normalized)
      results.push(entry)
    }
    if (results.length >= 8) break
  }

  return results
}

function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ""
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase()
}

function buildJobSeekerProfile(payload) {
  if (!payload) return null

  const jobSeekerId = payload.jobSeekerId ?? payload.job_seeker_id ?? payload.id ?? null
  const profile = payload.jobSeekerProfile || payload.job_seeker_profile

  if (profile) {
    return {
      id: profile.id ?? jobSeekerId ?? null,
      fullName: profile.fullName || profile.full_name || payload.name || "",
      full_name: profile.full_name || profile.fullName || payload.name || "",
      email: profile.email || payload.email || "",
      username: profile.username || "",
      phone: profile.phone || "",
    }
  }

  return {
    id: jobSeekerId,
    fullName: payload.name || "",
    full_name: payload.name || "",
    email: payload.email || "",
    username: payload.username || "",
    phone: payload.phone || "",
  }
}

function normalizeJobSeekerProfile(payload) {
  const source = payload?.jobSeeker || payload || {}
  const educationSource = payload?.educations ?? source?.education ?? source?.educations ?? []
  const experienceSource = payload?.experiences ?? source?.experience ?? source?.experiences ?? []

  return {
    id: source.id ?? payload?.jobSeekerId ?? payload?.job_seeker_id ?? null,
    fullName: source.fullName || source.full_name || payload?.name || "",
    full_name: source.full_name || source.fullName || payload?.name || "",
    email: source.email || payload?.email || "",
    username: source.username || "",
    phone: source.phone || "",
    status: source.status || payload?.status || "",
    address: source.address || source.location || payload?.address || payload?.location || "",
    aboutText: source.aboutText || payload?.aboutText || "",
    linkedInUrl: source.linkedInUrl || payload?.linkedInUrl || "",
    createdAt: source.createdAt || source.created_at || payload?.createdAt || payload?.created_at || null,
    education: Array.isArray(educationSource) ? educationSource.map(normalizeEducationItem) : [],
    experience: Array.isArray(experienceSource) ? experienceSource.map(normalizeExperienceItem) : [],
  }
}

function App() {
  const APPLICATION_MATCH_BONUS_PERCENT = 10

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
  const [registeredJobSeekers, setRegisteredJobSeekers] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [isLoadingUploads, setIsLoadingUploads] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "desc" })
  const [showTopApplicants, setShowTopApplicants] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [actionsMenu, setActionsMenu] = useState(null)
  const [viewItem, setViewItem] = useState(null)
  const [activePage, setActivePage] = useState(() => localStorage.getItem("activePage") || "applicants")
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem("isAuthenticated") === "true")
  const [userRole, setUserRole] = useState(() => localStorage.getItem("userRole") || "")
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = localStorage.getItem("currentUser")
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  })
  const [loginError, setLoginError] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [loginMode, setLoginMode] = useState(() => localStorage.getItem("loginMode") || "staff")
  const [isRegistering, setIsRegistering] = useState(false)
  const [isViewingLanding, setIsViewingLanding] = useState(true)
  const [jobSeekerProfile, setJobSeekerProfile] = useState(() => {
    const stored = localStorage.getItem("jobSeekerProfile")
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  })
  const [jobSeekerResume, setJobSeekerResume] = useState(null)
  const [jobSeekerSupporting, setJobSeekerSupporting] = useState([])
  const [jobSeekerId, setJobSeekerId] = useState(() => {
    const stored = localStorage.getItem("jobSeekerId")
    return stored ? Number(stored) : null
  })
  const handleJobSeekerProfileUpdate = useCallback((profile) => {
    const normalized = normalizeJobSeekerProfile(profile)
    setJobSeekerProfile(normalized)
    localStorage.setItem("jobSeekerProfile", JSON.stringify(normalized))
  }, [])
  const [registerFullName, setRegisterFullName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerUsername, setRegisterUsername] = useState("")
  const [registerPhone, setRegisterPhone] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("")
  const [registerError, setRegisterError] = useState("")
  const [registerNotice, setRegisterNotice] = useState("")
  const [landingSectionTarget, setLandingSectionTarget] = useState("")
  const [uploadStatus, setUploadStatus] = useState("")
  const [uploadNotice, setUploadNotice] = useState("")
  const [appliedJobTitle, setAppliedJobTitle] = useState("")
  const [isAppliedJobOpen, setIsAppliedJobOpen] = useState(false)
  const [jobFilter, setJobFilter] = useState("all")
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notificationSearch, setNotificationSearch] = useState("")
  const [notificationStatus, setNotificationStatus] = useState("all")
  const [notificationPage, setNotificationPage] = useState(1)
  const [adminNotificationPage, setAdminNotificationPage] = useState(1)
  const [readNotificationIds, setReadNotificationIds] = useState([])
  const [selectedJobView, setSelectedJobView] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmDeleteContext, setConfirmDeleteContext] = useState("application")
  const [deleteToast, setDeleteToast] = useState(null)
  const deleteToastTimerRef = useRef(null)
  const [summaryItem, setSummaryItem] = useState(null)
  const [summarySupportingFiles, setSummarySupportingFiles] = useState([])
  const [summarySupportingError, setSummarySupportingError] = useState("")
  const [resumeAttention, setResumeAttention] = useState(false)
  const [showJobSeekerSetupGuide, setShowJobSeekerSetupGuide] = useState(false)
  const [jobSeekerSetupStep, setJobSeekerSetupStep] = useState(0)
  const [activeJobSeekerPageIntro, setActiveJobSeekerPageIntro] = useState(null)
  const summaryRef = useRef(null)
  const pageRef = useRef(null)
  const isHandlingPopState = useRef(false)
  const hasCheckedServerSession = useRef(false)
  const isEmployer = userRole === "employer"
  const isAdmin = userRole === "admin"
  const isJobSeeker = userRole === "jobseeker"
  const normalizedPhone = phone.length ? `+63${phone}` : ""
  const resolvedJobSeekerId = jobSeekerId || jobSeekerProfile?.id || null

  const applyAuthenticatedSession = useCallback((payload) => {
    const nextRole = normalizeRole(payload?.role) || "jobseeker"
    const nextActivePage = "dashboard"
    const nextJobSeekerProfile = nextRole === "jobseeker" ? buildJobSeekerProfile(payload) : null
    const nextJobSeekerId = nextRole === "jobseeker"
      ? (payload?.jobSeekerId ?? payload?.job_seeker_id ?? payload?.id ?? nextJobSeekerProfile?.id ?? null)
      : null

    setIsAuthenticated(true)
    localStorage.setItem("isAuthenticated", "true")

    setUserRole(nextRole)
    localStorage.setItem("userRole", nextRole)

    const nextCurrentUser = {
      id: payload?.id ?? null,
      name: payload?.name || payload?.companyName || payload?.company_name || payload?.fullName || payload?.full_name || payload?.email || "",
      email: payload?.email || "",
      role: nextRole
    }
    setCurrentUser(nextCurrentUser)
    localStorage.setItem("currentUser", JSON.stringify(nextCurrentUser))

    setActivePage(nextActivePage)
    localStorage.setItem("activePage", nextActivePage)

    if (nextRole === "jobseeker") {
      setJobSeekerId(nextJobSeekerId)
      if (nextJobSeekerId != null) {
        localStorage.setItem("jobSeekerId", String(nextJobSeekerId))
      } else {
        localStorage.removeItem("jobSeekerId")
      }

      setJobSeekerProfile(nextJobSeekerProfile)
      if (nextJobSeekerProfile) {
        localStorage.setItem("jobSeekerProfile", JSON.stringify(nextJobSeekerProfile))
      } else {
        localStorage.removeItem("jobSeekerProfile")
      }
    } else {
      setJobSeekerProfile(null)
      setJobSeekerId(null)
      localStorage.removeItem("jobSeekerProfile")
      localStorage.removeItem("jobSeekerId")
    }

    setIsRegistering(false)
    setLoginError("")
  }, [])

  useEffect(() => {
    localStorage.setItem("loginMode", loginMode)
  }, [loginMode])

  useEffect(() => {
    setLoginError("")
  }, [loginMode])

  const handleJobSeekerResumeUpdate = useCallback((resume) => {
    setJobSeekerResume(resume || null)
  }, [])

  const handleJobSeekerSupportingUpdate = useCallback((files) => {
    setJobSeekerSupporting(Array.isArray(files) ? files : [])
  }, [])

  const navigateToLandingSection = useCallback((sectionId = "landing-hero") => {
    setIsRegistering(false)
    setIsViewingLanding(true)
    setLandingSectionTarget(sectionId)
  }, [])

  const showDeleteToast = useCallback((message, type = "success", duration = 2600) => {
    if (deleteToastTimerRef.current) {
      window.clearTimeout(deleteToastTimerRef.current)
      deleteToastTimerRef.current = null
    }
    setDeleteToast({ message, type })
    if (duration > 0) {
      deleteToastTimerRef.current = window.setTimeout(() => {
        setDeleteToast(null)
        deleteToastTimerRef.current = null
      }, duration)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (deleteToastTimerRef.current) {
        window.clearTimeout(deleteToastTimerRef.current)
      }
    }
  }, [])

  const requestResumeAttention = useCallback(() => {
    setResumeAttention(true)
    setActivePage("profile")
  }, [])

  const getJobSeekerSetupGuideKey = useCallback((id = resolvedJobSeekerId) => (
    `jobSeekerSetupGuideDismissed:${id || jobSeekerProfile?.email || "unknown"}`
  ), [jobSeekerProfile?.email, resolvedJobSeekerId])

  const getJobSeekerIntroEnabledKey = useCallback((id = resolvedJobSeekerId) => (
    `jobSeekerPageIntroEnabled:${id || jobSeekerProfile?.email || "unknown"}`
  ), [jobSeekerProfile?.email, resolvedJobSeekerId])

  const getJobSeekerPageIntroKey = useCallback((page, id = resolvedJobSeekerId) => (
    `jobSeekerPageIntroSeen:${id || jobSeekerProfile?.email || "unknown"}:${page}`
  ), [jobSeekerProfile?.email, resolvedJobSeekerId])

  const openJobSeekerSetupGuide = useCallback(() => {
    setJobSeekerSetupStep(0)
    setShowJobSeekerSetupGuide(true)
  }, [])

  const closeJobSeekerSetupGuide = useCallback(() => {
    if (isJobSeeker) {
      localStorage.setItem(getJobSeekerSetupGuideKey(), "true")
    }
    setShowJobSeekerSetupGuide(false)
    setJobSeekerSetupStep(0)
  }, [getJobSeekerSetupGuideKey, isJobSeeker])

  const closeJobSeekerPageIntro = useCallback(() => {
    if (activeJobSeekerPageIntro) {
      localStorage.setItem(getJobSeekerPageIntroKey(activeJobSeekerPageIntro), "true")
    }
    setActiveJobSeekerPageIntro(null)
  }, [activeJobSeekerPageIntro, getJobSeekerPageIntroKey])

  const goToJobSeekerSetupProfile = useCallback(() => {
    closeJobSeekerSetupGuide()
    setResumeAttention(true)
    handleTopNav("profile")
  }, [closeJobSeekerSetupGuide])

  useEffect(() => {
    if (!isAuthenticated || !isJobSeeker || !resolvedJobSeekerId || showJobSeekerSetupGuide || activeJobSeekerPageIntro) return
    if (!jobSeekerPageIntros[activePage]) return
    if (localStorage.getItem(getJobSeekerIntroEnabledKey()) !== "true") return
    if (localStorage.getItem(getJobSeekerPageIntroKey(activePage)) === "true") return

    setActiveJobSeekerPageIntro(activePage)
  }, [
    activeJobSeekerPageIntro,
    activePage,
    getJobSeekerIntroEnabledKey,
    getJobSeekerPageIntroKey,
    isAuthenticated,
    isJobSeeker,
    resolvedJobSeekerId,
    showJobSeekerSetupGuide
  ])

  useEffect(() => {
    if (!isAuthenticated || !isJobSeeker || !resolvedJobSeekerId) {
      setJobSeekerResume(null)
      return
    }
    let isMounted = true
    const fetchResume = async () => {
      try {
        const response = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/resume`)
        if (!response.ok) {
          setJobSeekerResume(null)
          return
        }
        const payload = await response.json()
        if (!isMounted) return
        setJobSeekerResume(payload?.resume || null)
      } catch {
        if (isMounted) {
          setJobSeekerResume(null)
        }
      }
    }
    fetchResume()
    return () => {
      isMounted = false
    }
  }, [isAuthenticated, isJobSeeker, resolvedJobSeekerId])

  useEffect(() => {
    if (!isAuthenticated || !isJobSeeker || !resolvedJobSeekerId) {
      setJobSeekerSupporting([])
      return
    }
    let isMounted = true
    const fetchSupporting = async () => {
      try {
        const response = await fetch(`http://localhost:5000/job-seekers/${resolvedJobSeekerId}/supporting`)
        if (!response.ok) {
          setJobSeekerSupporting([])
          return
        }
        const payload = await response.json()
        if (!isMounted) return
        setJobSeekerSupporting(Array.isArray(payload?.files) ? payload.files : [])
      } catch {
        if (isMounted) {
          setJobSeekerSupporting([])
        }
      }
    }
    fetchSupporting()
    return () => {
      isMounted = false
    }
  }, [isAuthenticated, isJobSeeker, resolvedJobSeekerId])

  const notificationStorageKey = useMemo(() => {
    if (!isAuthenticated) return null
    if (isJobSeeker) {
      return `readNotifications:jobseeker:${jobSeekerId || jobSeekerProfile?.email || "unknown"}`
    }
    return `readNotifications:${userRole || "user"}`
  }, [isAuthenticated, isJobSeeker, jobSeekerId, jobSeekerProfile?.email, userRole])

  useEffect(() => {
    if (!notificationStorageKey) return
    const stored = localStorage.getItem(notificationStorageKey)
    if (!stored) {
      setReadNotificationIds([])
      return
    }
    try {
      const parsed = JSON.parse(stored)
      setReadNotificationIds(Array.isArray(parsed) ? parsed : [])
    } catch {
      setReadNotificationIds([])
    }
  }, [notificationStorageKey])

  const markNotificationsRead = useCallback((ids) => {
    if (!notificationStorageKey || !ids.length) return
    const next = Array.from(new Set([...readNotificationIds, ...ids]))
    setReadNotificationIds(next)
    localStorage.setItem(notificationStorageKey, JSON.stringify(next))
  }, [notificationStorageKey, readNotificationIds])

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

  const fetchRegisteredJobSeekers = async () => {
    if (isJobSeeker) {
      setRegisteredJobSeekers([])
      return
    }

    try {
      const response = await fetch("http://localhost:5000/job-seekers/all")
      if (!response.ok) {
        throw new Error("Failed to fetch registered applicants.")
      }
      const data = await response.json()
      setRegisteredJobSeekers(Array.isArray(data) ? data : [])
    } catch (error) {
      setRegisteredJobSeekers([])
    }
  }

  const fetchActivityLogs = useCallback(async () => {
    if (!isAuthenticated || isJobSeeker) {
      setActivityLogs([])
      return []
    }

    try {
      const response = await fetch("/api/activity-logs")
      if (!response.ok) {
        throw new Error("Failed to fetch activity logs.")
      }
      const data = await response.json()
      const logs = Array.isArray(data) ? data : []
      setActivityLogs(logs)
      return logs
    } catch (error) {
      setActivityLogs([])
      return []
    }
  }, [isAuthenticated, isJobSeeker])

  const recordActivity = useCallback(async ({
    event,
    description,
    subjectType = "",
    subjectId = null,
    subjectName = "",
    metadata = {}
  }) => {
    if (!event || !description || isJobSeeker) return

    try {
      await fetch("/api/activity-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getArchiveActorHeaders(currentUser || { name: loginEmail, email: loginEmail, role: userRole })
        },
        body: JSON.stringify({
          event,
          description,
          subjectType,
          subjectId,
          subjectName,
          metadata
        })
      })
      await fetchActivityLogs()
    } catch (error) {
      // Activity logging should never block the action the user just completed.
    }
  }, [currentUser, fetchActivityLogs, isJobSeeker, loginEmail, userRole])

  const openAddApplicantModal = async () => {
    await fetchJobPosts()
    setIsUploadModalOpen(true)
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchUploads()
      fetchJobPosts()
      fetchRegisteredJobSeekers()
      fetchActivityLogs()
    }
  }, [fetchActivityLogs, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    localStorage.setItem("activePage", activePage)
  }, [activePage, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !isJobSeeker || !resolvedJobSeekerId) return
    if (!jobSeekerPageIntros[activePage]) return
    localStorage.setItem(`jobSeekerPageVisited:${resolvedJobSeekerId}:${activePage}`, "true")
  }, [activePage, isAuthenticated, isJobSeeker, resolvedJobSeekerId])

  useEffect(() => {
    const onPopState = (event) => {
      const state = event.state
      if (!state || !state.page) return
      isHandlingPopState.current = true
      setActivePage(state.page)
      if (state.page === "job-view") {
        const jobId = state.jobId
        if (jobId != null) {
          const matched = jobPosts.find((job) => job.id === jobId)
          setSelectedJobView(matched || null)
        }
      } else {
        setSelectedJobView(null)
      }
      setTimeout(() => {
        isHandlingPopState.current = false
      }, 0)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [jobPosts])

  useEffect(() => {
    if (!isAuthenticated) return
    if (isHandlingPopState.current) return
    const state = { page: activePage }
    if (activePage === "job-view" && selectedJobView?.id != null) {
      state.jobId = selectedJobView.id
    }
    window.history.pushState(state, "")
  }, [activePage, selectedJobView, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    if (userRole === "jobseeker" && activePage !== "jobs" && activePage !== "profile" && activePage !== "dashboard" && activePage !== "job-view" && activePage !== "help") {
      setActivePage("jobs")
    }
  }, [activePage, isAuthenticated, userRole])

  useEffect(() => {
    const closeActions = () => {
      setActionsMenu(null)
      setIsProfileMenuOpen(false)
      setIsAppliedJobOpen(false)
      setIsNotificationsOpen(false)
    }
    document.addEventListener("click", closeActions)
    window.addEventListener("resize", closeActions)
    window.addEventListener("scroll", closeActions, true)

    return () => {
      document.removeEventListener("click", closeActions)
      window.removeEventListener("resize", closeActions)
      window.removeEventListener("scroll", closeActions, true)
    }
  }, [])

  useEffect(() => {
    const pageElement = pageRef.current
    const updateBackToTop = () => {
      const scrollTop = Math.max(
        window.scrollY || document.documentElement.scrollTop || 0,
        pageElement?.scrollTop || 0
      )
      setShowBackToTop(scrollTop > 240)
    }

    updateBackToTop()
    window.addEventListener("scroll", updateBackToTop, { passive: true })
    pageElement?.addEventListener("scroll", updateBackToTop, { passive: true })
    return () => {
      window.removeEventListener("scroll", updateBackToTop)
      pageElement?.removeEventListener("scroll", updateBackToTop)
    }
  }, [])

  const scrollBackToTop = () => {
    pageRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    document.scrollingElement?.scrollTo({ top: 0, behavior: "smooth" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const openActionsMenu = (event, item) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const menuHeight = 120
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const preferredTop = rect.bottom + 2
    const top = preferredTop + menuHeight > viewportHeight
      ? Math.max(12, rect.top - menuHeight - 2)
      : preferredTop
    setActionsMenu({
      item,
      top,
      left: Math.max(12, rect.right - 140)
    })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const normalizedMode = loginMode === "jobseeker" ? "jobseeker" : "staff"
      const isJobSeekerLogin = normalizedMode === "jobseeker"
      const response = await fetch(isJobSeekerLogin ? "/api/job-seekers/login" : "/api/staff/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: "same-origin",
        body: isJobSeekerLogin
          ? JSON.stringify({
              identifier: loginEmail.trim(),
              password: loginPassword,
            })
          : JSON.stringify({
              email: loginEmail.trim(),
              password: loginPassword,
            }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const firstError =
          payload?.errors?.identifier?.[0] ||
          payload?.errors?.email?.[0] ||
          payload?.errors?.password?.[0]
        setLoginPassword("")
        throw new Error(payload?.message || firstError || "Invalid email or password.")
      }
      const payload = await response.json().catch(() => null)
      if (isJobSeekerLogin) {
        if (!payload) {
          throw new Error("Login succeeded, but we could not load your account.")
        }
        setLoginPassword("")
        applyAuthenticatedSession({
          ...payload,
          role: "jobseeker",
        })
        return
      }

      setLoginPassword("")
      applyAuthenticatedSession(payload)
    } catch (err) {
      setLoginError(err.message || "Invalid email or password.")
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!registerFullName.trim() || !registerEmail.trim() || !registerPassword.trim()) {
      setRegisterError("Please fill in all fields.")
      return
    }
    if (!/[A-Z]/.test(registerPassword) || !/\d/.test(registerPassword) || !/[^A-Za-z0-9]/.test(registerPassword)) {
      setRegisterError("Password must include a capital letter, a number, and a special character.")
      return
    }
    if (registerPassword !== registerConfirmPassword) {
      setRegisterError("Passwords do not match.")
      return
    }
    setRegisterError("")
    try {
      const response = await fetch("/api/job-seekers/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          fullName: registerFullName.trim(),
          email: registerEmail.trim(),
          password: registerPassword,
          confirmPassword: registerConfirmPassword,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const firstError =
          payload?.errors?.name?.[0] ||
          payload?.errors?.email?.[0] ||
          payload?.errors?.password?.[0]
        throw new Error(firstError || payload?.message || "Registration failed.")
      }
      setRegisterFullName("")
      setRegisterEmail("")
      setRegisterPassword("")
      setRegisterConfirmPassword("")
      setRegisterNotice("")
      const payload = await response.json().catch(() => null)
      const userPayload = payload?.jobSeeker ?? payload
      if (!userPayload?.id) {
        throw new Error("Registration succeeded, but we could not load your account.")
      }
      applyAuthenticatedSession({
        ...userPayload,
        role: "jobseeker",
      })
      localStorage.removeItem(`jobSeekerSetupGuideDismissed:${userPayload.id}`)
      localStorage.setItem(`jobSeekerPageIntroEnabled:${userPayload.id}`, "true")
      setJobSeekerSetupStep(0)
      setShowJobSeekerSetupGuide(true)
    } catch (err) {
      setRegisterNotice("")
      setRegisterError(err.message || "Registration failed.")
    }
  }

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "X-CSRF-TOKEN": getCsrfToken(),
        },
        credentials: "same-origin",
      })
    } catch {
      // Local session cleanup still happens even if the server is unreachable.
    }
    setIsAuthenticated(false)
    localStorage.removeItem("isAuthenticated")
    setUserRole("")
    setCurrentUser(null)
    localStorage.removeItem("userRole")
    localStorage.removeItem("currentUser")
    localStorage.removeItem("activePage")
    localStorage.removeItem("jobSeekerProfile")
    localStorage.removeItem("jobSeekerId")
    setActionsMenu(null)
    setActiveJobSeekerPageIntro(null)
    setShowJobSeekerSetupGuide(false)
    setIsProfileMenuOpen(false)
    setViewItem(null)
    setJobSeekerProfile(null)
    setJobSeekerSupporting([])
    setJobSeekerId(null)
    setActivePage("applicants")
    setSelectedJobView(null)
    setIsRegistering(false)
    setIsViewingLanding(false)
    setLandingSectionTarget("")
  }, [])

  useEffect(() => {
    if (hasCheckedServerSession.current) return
    hasCheckedServerSession.current = true
    if (!isAuthenticated) return

    let cancelled = false
    const verifyServerSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
          credentials: "same-origin",
        })
        const payload = await response.json().catch(() => null)
        if (cancelled) return

        if (!response.ok || !payload?.authenticated || !payload?.user) {
          await handleLogout()
          return
        }

        applyAuthenticatedSession(payload.user)
      } catch {
        if (!cancelled) {
          await handleLogout()
        }
      }
    }

    verifyServerSession()

    return () => {
      cancelled = true
    }
  }, [applyAuthenticatedSession, handleLogout, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const hasMissingRole = !userRole
    const hasMissingJobSeekerIdentity = userRole === "jobseeker" && !resolvedJobSeekerId
    if (!hasMissingRole && !hasMissingJobSeekerIdentity) return

    setLoginError("Account not found. Please log in again.")
    setIsRegistering(false)
    handleLogout()
  }, [isAuthenticated, userRole, resolvedJobSeekerId, handleLogout])

  const fetchSupportingFilesForSummary = useCallback(async (uploadId) => {
    if (!uploadId) {
      setSummarySupportingFiles([])
      setSummarySupportingError("")
      return []
    }
    try {
      setSummarySupportingError("")
      const response = await fetch(`http://localhost:5000/uploads/${uploadId}/supporting`)
      if (!response.ok) {
        throw new Error("Failed to load supporting documents.")
      }
      const payload = await response.json()
      const files = Array.isArray(payload?.files) ? payload.files : []
      setSummarySupportingFiles(files)
      return files
    } catch (error) {
      setSummarySupportingFiles([])
      setSummarySupportingError(error.message || "Failed to load supporting documents.")
      return []
    }
  }, [])

  const downloadApplicantSummary = async (item) => {
    if (!item) return
    const name = item.name || "Applicant"
    const appliedJob = item.applied_job_title || item.matched_job_title || "-"
    const uploadedAt = item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : "-"
    const supportingFiles = await fetchSupportingFilesForSummary(item.id)
    const supportingNames = supportingFiles.length
      ? supportingFiles.map((file) => file.original_name || "Supporting document").join(", ")
      : "None"
    const lines = [
      "Applicant Summary",
      "=================",
      `Name: ${name}`,
      `Email: ${item.email || "-"}`,
      `Phone: ${item.phone || "-"}`,
      `Applied Job: ${appliedJob}`,
      `Match Score: ${item.match_score != null ? `${Number(item.match_score).toFixed(2)}%` : "-"}`,
      `Classification: ${item.classification || "-"}`,
      `Matched Skills: ${item.matched_skills || "-"}`,
      `Missing Skills: ${item.missing_skills || "-"}`,
      `Supporting Documents: ${supportingNames}`,
      `Uploaded File: ${item.original_name || "-"}`,
      `Uploaded At: ${uploadedAt}`
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    const safeName = String(name || "applicant")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    anchor.href = url
    anchor.download = `${safeName || "applicant"}-summary.txt`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    await recordActivity({
      event: "application.summary_downloaded",
      description: `Downloaded application summary for ${name}.`,
      subjectType: "application",
      subjectId: item.id,
      subjectName: name,
      metadata: {
        jobTitle: appliedJob,
        format: "txt"
      }
    })
  }

  const downloadApplicantSummaryPdf = async (item) => {
    if (!item) return
    const safeName = String(item.name || "applicant")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    setSummaryItem(item)
    await fetchSupportingFilesForSummary(item.id)
    requestAnimationFrame(() => {
      const node = summaryRef.current
      if (!node) return
      html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true
      }).then(async (canvas) => {
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: "a4"
        })
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const margin = 18
        const printableWidth = pageWidth - margin * 2
        const printableHeight = pageHeight - margin * 2
        const scale = Math.min(printableWidth / canvas.width, printableHeight / canvas.height)
        const imageWidth = canvas.width * scale
        const imageHeight = canvas.height * scale
        const x = margin
        const y = margin
        const imageData = canvas.toDataURL("image/jpeg", 0.92)
        pdf.addImage(imageData, "JPEG", x, y, imageWidth, imageHeight)

        pdf.save(`${safeName || "applicant"}-summary.pdf`)
        await recordActivity({
          event: "application.summary_downloaded",
          description: `Downloaded application summary for ${item.name || "Applicant"}.`,
          subjectType: "application",
          subjectId: item.id,
          subjectName: item.name || "Applicant",
          metadata: {
            jobTitle: item.applied_job_title || item.matched_job_title || "-",
            format: "pdf"
          }
        })
      })
    })
  }

  const summaryEducation = summaryItem?.education_text
    ? String(summaryItem.education_text).split(/\n+/).map((line) => line.trim()).filter(Boolean)
    : extractEducationLines(summaryItem?.extracted_text)
  const summaryExperience = Array.isArray(summaryItem?.experience_json) && summaryItem.experience_json.length
    ? summaryItem.experience_json.map((line) => String(line).trim()).filter(Boolean)
    : extractExperienceLines(summaryItem?.experience_text || summaryItem?.extracted_text)
  const summaryMatchedSkills = parseSkills(summaryItem?.matched_skills)
  const summaryMissingSkills = parseMissingSkills(summaryItem?.missing_skills)
  const summaryOverall = summaryItem?.match_score != null ? Number(summaryItem.match_score) : 0
  const summarySkillsMatch = Math.min(100, summaryMatchedSkills.length * 12)
  const summaryEducationMatch = summaryEducation.length ? 60 : 10
  const summaryExperienceMatch = summaryExperience.length ? 55 : 0

  const handleTopNav = (page) => {
    setActivePage(page)
    setActionsMenu(null)
    setIsProfileMenuOpen(false)
    setIsAppliedJobOpen(false)
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
    const selectedAppliedJob = jobPosts.find((job) => (
      String(job.status || "active").toLowerCase() === "active"
      && String(job.title || "").trim().toLowerCase() === appliedJobTitle.trim().toLowerCase()
    ))
    if (selectedAppliedJob?.id != null) {
      formData.append("jobId", String(selectedAppliedJob.id))
    }
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

  const handleJobSeekerApply = async ({
    name: applicantName,
    email: applicantEmail,
    phone: applicantPhone,
    file: resumeFile,
    supportingFiles = [],
    supportingTypes = [],
    jobId = null,
    appliedJobTitle,
    baseMatchScore = null,
    totalMatchScore = null,
    matchBonusPercentage = APPLICATION_MATCH_BONUS_PERCENT
  }) => {
    const normalizedName = String(applicantName || "").trim()
    const normalizedEmail = String(applicantEmail || "").trim()
    const phoneDigits = String(applicantPhone || "").replace(/\D/g, "")
    let normalizedPhone = phoneDigits
    if (normalizedPhone.startsWith("63")) {
      normalizedPhone = normalizedPhone.slice(2)
    }
    if (normalizedPhone.startsWith("0")) {
      normalizedPhone = normalizedPhone.slice(1)
    }
    const normalizedJobTitle = String(appliedJobTitle || "").trim()
    const normalizedJobId = jobId != null && String(jobId).trim() !== "" ? String(jobId).trim() : ""

    if (!normalizedName || !normalizedEmail || !normalizedPhone || !normalizedJobTitle) {
      return { ok: false, message: "Please fill in all fields." }
    }
    if (!/^\d{10}$/.test(normalizedPhone)) {
      return { ok: false, message: "Phone number must be exactly 10 digits after +63." }
    }
    if (!resumeFile) {
      return { ok: false, message: "Please upload a resume/CV file." }
    }

    const numericBonus = Number(matchBonusPercentage)
    const safeBonus = Number.isFinite(numericBonus) ? numericBonus : APPLICATION_MATCH_BONUS_PERCENT
    const numericBase = Number(baseMatchScore)
    const computedTotalScore = Number.isFinite(numericBase)
      ? Math.min(100, numericBase + safeBonus)
      : null
    const numericProvidedTotal = Number(totalMatchScore)
    const finalTotalScore = Number.isFinite(numericProvidedTotal)
      ? Math.min(100, numericProvidedTotal)
      : computedTotalScore

    const formData = new FormData()
    formData.append("name", normalizedName)
    formData.append("email", normalizedEmail)
    formData.append("phone", `+63${normalizedPhone}`)
    formData.append("appliedJobTitle", normalizedJobTitle)
    if (normalizedJobId) {
      formData.append("jobId", normalizedJobId)
    }
    if (resolvedJobSeekerId) {
      formData.append("jobSeekerId", String(resolvedJobSeekerId))
    }
    formData.append("matchBonusPercentage", String(safeBonus))
    if (baseMatchScore != null && Number.isFinite(Number(baseMatchScore))) {
      formData.append("baseMatchScore", String(Number(baseMatchScore)))
    }
    if (finalTotalScore != null) {
      formData.append("totalMatchScore", String(finalTotalScore))
      // Compatibility key if backend expects a generic score field.
      formData.append("matchScore", String(finalTotalScore))
    }
    formData.append("file", resumeFile)
    supportingFiles.forEach((file) => {
      formData.append("supportingFiles", file)
    })
    supportingTypes.forEach((type) => {
      formData.append("supportingTypes", type)
    })

    try {
      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.message || "Failed to submit application."
        showUploadNotice("fail", message)
        return { ok: false, message, invalidSupporting: payload?.invalidSupporting || [] }
      }

      showUploadNotice("success", "Application submitted successfully.")
      await fetchUploads({ silent: true })
      await fetchJobPosts()
      setSelectedJobView(null)
      setActivePage("jobs")
      return { ok: true }
    } catch (error) {
      showUploadNotice("fail", "Failed to submit application.")
      return { ok: false, message: "Failed to submit application." }
    }
  }

  // Delete record handler
  const performDelete = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/uploads/${id}`, {
        method: "DELETE",
        headers: getArchiveActorHeaders(currentUser || { name: loginEmail, email: loginEmail, role: userRole })
      })

      if (!response.ok) {
        setMessage("Failed to delete record.")
        return false
      }

      // Update UI immediately so Jobs modal/Applicants table refresh without waiting for refetch.
      setUploads((prev) => prev.filter((item) => item.id !== id))
      setMessage("Upload record deleted.")
      showDeleteToast("Delete successful.", "success")
      fetchUploads({ silent: true })
      fetchActivityLogs()
      return true
    } catch (error) {
      setMessage("Error deleting record.")
      showDeleteToast("Failed to delete record.", "fail")
      return false
    }
  }

  const performHideApplication = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/uploads/${id}/hide`, {
        method: "PUT",
        headers: getArchiveActorHeaders(currentUser || { name: loginEmail, email: loginEmail, role: userRole })
      })
      if (!response.ok) {
        setMessage("Failed to hide application.")
        return false
      }
      setUploads((prev) => prev.map((item) => (
        item.id === id ? { ...item, job_seeker_hidden: 1 } : item
      )))
      setMessage("Application hidden.")
      showDeleteToast("Application deleted.", "success")
      fetchActivityLogs()
      return true
    } catch (error) {
      setMessage("Error hiding application.")
      showDeleteToast("Failed to hide application.", "fail")
      return false
    }
  }

  const markApplicantForInterview = async (item) => {
    if (!item?.id) return
    setActionsMenu(null)
    try {
      const response = await fetch(`http://localhost:5000/uploads/${item.id}/evaluation`, {
        method: "PUT",
        headers: getArchiveActorHeaders(currentUser || { name: loginEmail, email: loginEmail, role: userRole })
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to send applicant for evaluation.")
      }
      setUploads((prev) => prev.map((upload) => (
        upload.id === item.id ? { ...upload, ...payload } : upload
      )))
      showDeleteToast("Applicant moved to Ratings / Evaluation.", "success")
      await fetchUploads({ silent: true })
      await fetchActivityLogs()
    } catch (error) {
      showDeleteToast(error.message || "Failed to send applicant for evaluation.", "fail")
    }
  }

  const handleDelete = (id, context = "application") => {
    setActionsMenu(null)
    setConfirmDeleteId(id)
    setConfirmDeleteContext(context)
    return false
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
    recordActivity({
      event: "application.viewed",
      description: `Viewed application summary for ${item.name || "Applicant"}.`,
      subjectType: "application",
      subjectId: item.id,
      subjectName: item.name || "Applicant",
      metadata: {
        jobTitle: item.applied_job_title || item.matched_job_title || "-"
      }
    })
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

  const topApplicants = useMemo(() => {
    const ranked = [...filteredUploads].sort((a, b) => {
      const scoreDelta = Number(b.match_score || 0) - Number(a.match_score || 0)
      if (scoreDelta !== 0) return scoreDelta
      return new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0)
    })
    return ranked.slice(0, 10)
  }, [filteredUploads])

  const displayedUploads = showTopApplicants ? topApplicants : filteredUploads

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
  const appliedJobSuggestions = activeJobPosts.map((job) => String(job.title || "").trim()).filter(Boolean)

  const dashboardData = useMemo(() => {
    const normalize = (value) => String(value || "").trim().toLowerCase()
    const resolveJobTitle = (item) => String(item.applied_job_title || item.matched_job_title || "").trim()
    const resolveUploadDate = (item) => item.uploaded_at || item.uploadedAt || item.created_at || item.createdAt
    const resolveRegisteredDate = (item) => item.created_at || item.createdAt || item.registered_at || item.registeredAt
    const resolveJobPosition = (item) => {
      const directPosition = item.jobPositionType || item.job_position_type || item.jobPosition || item.job_position
      if (directPosition) return directPosition

      const jobId = Number(item.jobId || item.job_id)
      const title = resolveJobTitle(item)
      const job = jobPosts.find((post) => {
        if (jobId > 0 && Number(post.id || post.jobId || post.job_id) === jobId) {
          return true
        }
        return normalize(post.title) === normalize(title)
      })
      return job?.jobPosition || job?.job_position || ""
    }
    const jobPositionRank = (value) => {
      const position = normalize(value)
      if (position === "teaching") return 0
      if (position === "non-teaching") return 1
      return 2
    }
    const sortByJobPositionType = (a, b) => {
      const rankDelta = jobPositionRank(a.jobPosition || a.job_position) - jobPositionRank(b.jobPosition || b.job_position)
      return rankDelta || String(a.title || "").localeCompare(String(b.title || ""))
    }

    let highlyQualified = 0
    let moderatelyQualified = 0
    let notQualified = 0
    let scoreSum = 0
    let scoreCount = 0
    const applicantsByJob = new Map()
    const applicantsByPositionType = new Map([
      ["Teaching", 0],
      ["Non-Teaching", 0],
      ["Other", 0]
    ])
    const applicantsByYearMap = new Map()

    uploads.forEach((item) => {
      const cls = normalize(item.classification)
      const jobTitle = resolveJobTitle(item)
      const positionType = resolveJobPosition(item)
      const normalizedPositionType = normalize(positionType)
      const positionBucket = normalizedPositionType === "teaching"
        ? "Teaching"
        : normalizedPositionType === "non-teaching"
          ? "Non-Teaching"
          : "Other"
      applicantsByPositionType.set(positionBucket, (applicantsByPositionType.get(positionBucket) || 0) + 1)

      if (jobTitle) {
        if (!applicantsByJob.has(jobTitle)) {
          applicantsByJob.set(jobTitle, {
            title: jobTitle,
            jobPosition: resolveJobPosition(item),
            total: 0,
            highlyQualified: 0,
            moderatelyQualified: 0,
            notQualified: 0
          })
        }
        const bucket = applicantsByJob.get(jobTitle)
        bucket.total += 1
        if (cls.includes("not qualified")) {
          bucket.notQualified += 1
        } else if (cls.includes("moderately qualified")) {
          bucket.moderatelyQualified += 1
        } else if (cls.includes("highly qualified")) {
          bucket.highlyQualified += 1
        }
      }

      if (cls.includes("not qualified")) {
        notQualified += 1
      } else if (cls.includes("moderately qualified")) {
        moderatelyQualified += 1
      } else if (cls.includes("highly qualified")) {
        highlyQualified += 1
      }

      if (item.match_score != null && !Number.isNaN(Number(item.match_score))) {
        scoreSum += Number(item.match_score)
        scoreCount += 1
      }
    })

    const recentApplicants = [...uploads]
      .sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0))
      .slice(0, 4)

    const recentJobs = [...jobPosts]
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
      .slice(0, 4)

    const topApplicantsByJob = Array.from(applicantsByJob.keys())
      .map((jobTitle) => {
        const jobApplicants = uploads
          .filter((item) => resolveJobTitle(item) === jobTitle)
          .sort((a, b) => {
            const scoreDelta = Number(b.match_score || 0) - Number(a.match_score || 0)
            if (scoreDelta !== 0) return scoreDelta
            return new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0)
          })

        return {
          jobTitle,
          applicant: jobApplicants[0] || null,
          totalApplicants: jobApplicants.length
        }
      })
      .filter((item) => item.applicant)
      .sort((a, b) => a.jobTitle.localeCompare(b.jobTitle))

    const averageScore = scoreCount ? Number((scoreSum / scoreCount).toFixed(1)) : 0

    const scoreBuckets = {
      "0-49": 0,
      "50-69": 0,
      "70-84": 0,
      "85-100": 0
    }

    uploads.forEach((item) => {
      const score = Number(item.match_score)
      if (Number.isNaN(score)) return
      if (score < 50) scoreBuckets["0-49"] += 1
      else if (score < 70) scoreBuckets["50-69"] += 1
      else if (score < 85) scoreBuckets["70-84"] += 1
      else scoreBuckets["85-100"] += 1
    })

    registeredJobSeekers.forEach((item) => {
      const registeredDate = new Date(resolveRegisteredDate(item))
      if (Number.isNaN(registeredDate.getTime())) return
      const year = String(registeredDate.getFullYear())
      applicantsByYearMap.set(year, (applicantsByYearMap.get(year) || 0) + 1)
    })

    const topJobsByApplicants = Array.from(applicantsByJob.values())
      .map((job) => ({
        title: job.title,
        jobPosition: job.jobPosition,
        applicants: Number(job.total || 0),
        highlyQualified: Number(job.highlyQualified || 0),
        moderatelyQualified: Number(job.moderatelyQualified || 0),
        notQualified: Number(job.notQualified || 0)
      }))
      .sort((a, b) => b.applicants - a.applicants || a.title.localeCompare(b.title))
      .slice(0, 5)

    const applicantTotal = Math.max(1, uploads.length)
    const positionTypeDistribution = Array.from(applicantsByPositionType.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / applicantTotal) * 100)
      }))
      .filter((item) => item.count > 0 || item.type !== "Other")

    const monthKey = (date) => {
      const d = new Date(date)
      if (Number.isNaN(d.getTime())) return null
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    }

    const monthLabel = (key) => {
      const [year, month] = key.split("-")
      const d = new Date(Number(year), Number(month) - 1, 1)
      return d.toLocaleString(undefined, { month: "short", year: "numeric" })
    }

    const now = new Date()
    const recentMonths = []
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      recentMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }

    const applicantsByMonth = recentMonths.map((key) => ({
      key,
      label: monthLabel(key),
      count: 0
    }))

    const monthIndex = new Map(applicantsByMonth.map((m, idx) => [m.key, idx]))
    uploads.forEach((item) => {
      const key = monthKey(resolveUploadDate(item))
      if (!key || !monthIndex.has(key)) return
      applicantsByMonth[monthIndex.get(key)].count += 1
    })

    const applicantsByYear = Array.from(applicantsByYearMap.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => Number(a.year) - Number(b.year))

    return {
      openJobs: jobPosts.filter((job) => String(job.status || "active").toLowerCase() === "active").length,
      totalApplicants: uploads.length,
      highlyQualified,
      moderatelyQualified,
      notQualified,
      applicantJobs: Array.from(applicantsByJob.values()).sort(sortByJobPositionType),
      topApplicantsByJob,
      recentApplicants,
      recentJobs,
      averageScore,
      scoreBuckets,
      topJobsByApplicants,
      applicantsByMonth,
      applicantsByYear,
      positionTypeDistribution
    }
  }, [uploads, jobPosts, registeredJobSeekers])

  const getClassificationClass = (value) =>
    String(value || "").toLowerCase().replace(/\s+/g, "-")

  const getApplicationStatus = (item) => {
    const cls = String(item?.classification || "").toLowerCase()
    if (cls.includes("qualified") && !cls.includes("not")) return "Qualified"
    if (cls.includes("highly")) return "Qualified"
    if (cls.includes("moderately")) return "Moderately Qualified"
    if (cls.includes("not")) return "Not Qualified"
    return "Under Review"
  }

  const jobTitleMeta = useMemo(() => {
    const map = new Map()
    jobPosts.forEach((job) => {
      const title = String(job.title || "").trim()
      if (!title || map.has(title)) return
      map.set(title, {
        department: job.department || "-",
        title
      })
    })
    return map
  }, [jobPosts])

  const jobSeekerApplications = useMemo(() => {
    if (!isJobSeeker) return []
    const seekerEmail = String(jobSeekerProfile?.email || "").toLowerCase()
    const seekerName = String(jobSeekerProfile?.fullName || "").toLowerCase()
    return uploads.filter((item) => {
      if (Number(item.job_seeker_hidden) === 1) return false
      const emailMatch = seekerEmail && String(item.email || "").toLowerCase() === seekerEmail
      const nameMatch = seekerName && String(item.name || "").toLowerCase() === seekerName
      return emailMatch || nameMatch
    })
  }, [uploads, isJobSeeker, jobSeekerProfile])

  const unreadJobSeekerApplications = useMemo(() => (
    jobSeekerApplications.filter((item) => !readNotificationIds.includes(item.id))
  ), [jobSeekerApplications, readNotificationIds])

  const filteredNotifications = useMemo(() => {
    const query = notificationSearch.trim().toLowerCase()
    const statusFilter = notificationStatus.toLowerCase()
    return unreadJobSeekerApplications.filter((item) => {
      const jobTitle = String(item.applied_job_title || item.matched_job_title || "").toLowerCase()
      const department = String(jobTitleMeta.get(item.applied_job_title || item.matched_job_title || "")?.department || "").toLowerCase()
      if (query && !`${jobTitle} ${department}`.includes(query)) {
        return false
      }
      if (statusFilter !== "all") {
        return getApplicationStatus(item).toLowerCase() === statusFilter
      }
      return true
    })
  }, [unreadJobSeekerApplications, notificationSearch, notificationStatus, jobTitleMeta])

  const NOTIFICATIONS_PER_PAGE = 5

  useEffect(() => {
    setNotificationPage(1)
  }, [notificationSearch, notificationStatus])

  const adminNotifications = useMemo(() => {
    if (isJobSeeker) return []
    return [...uploads]
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      .filter((item) => !readNotificationIds.includes(item.id))
  }, [uploads, isJobSeeker, readNotificationIds])

  const notificationPageCount = Math.max(1, Math.ceil(filteredNotifications.length / NOTIFICATIONS_PER_PAGE))
  const adminNotificationPageCount = Math.max(1, Math.ceil(adminNotifications.length / NOTIFICATIONS_PER_PAGE))

  useEffect(() => {
    setNotificationPage((prev) => Math.min(Math.max(1, prev), notificationPageCount))
  }, [notificationPageCount])

  useEffect(() => {
    setAdminNotificationPage(1)
  }, [adminNotifications.length])

  useEffect(() => {
    setAdminNotificationPage((prev) => Math.min(Math.max(1, prev), adminNotificationPageCount))
  }, [adminNotificationPageCount])

  const pagedNotifications = useMemo(() => {
    const startIndex = (notificationPage - 1) * NOTIFICATIONS_PER_PAGE
    return filteredNotifications.slice(startIndex, startIndex + NOTIFICATIONS_PER_PAGE)
  }, [filteredNotifications, notificationPage])

  const pagedAdminNotifications = useMemo(() => {
    const startIndex = (adminNotificationPage - 1) * NOTIFICATIONS_PER_PAGE
    return adminNotifications.slice(startIndex, startIndex + NOTIFICATIONS_PER_PAGE)
  }, [adminNotifications, adminNotificationPage])

  const hasUnreadNotifications = isJobSeeker
    ? unreadJobSeekerApplications.length > 0
    : adminNotifications.length > 0

  if (!isAuthenticated) {
    if (isViewingLanding) {
      return (
        <LandingPage
          scrollToSectionId={landingSectionTarget}
          onLoginClick={() => setIsViewingLanding(false)}
          onRegisterClick={() => {
            setLoginMode("jobseeker")
            setIsViewingLanding(false)
            setIsRegistering(true)
          }}
        />
      )
    }
    if (isRegistering) {
      return (
      <RegisterPage
        fullName={registerFullName}
        setFullName={setRegisterFullName}
        email={registerEmail}
        setEmail={setRegisterEmail}
        password={registerPassword}
        setPassword={setRegisterPassword}
        confirmPassword={registerConfirmPassword}
        setConfirmPassword={setRegisterConfirmPassword}
        registerError={registerError}
        registerNotice={registerNotice}
        onSubmit={handleRegister}
        onBack={() => setIsRegistering(false)}
        onGoToLandingSection={navigateToLandingSection}
      />
      )
    }
    return (
      <LoginPage
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        loginError={loginError}
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
        loginMode={loginMode}
        setLoginMode={setLoginMode}
        onSubmit={handleLogin}
        onGoToLandingSection={navigateToLandingSection}
        onRegister={() => {
          setLoginMode("jobseeker")
          setIsRegistering(true)
        }}
      />
    )
  }

  const mainContent = (() => {
    if (activePage === "profile") {
      return (
        <ProfilePage
          userRole={userRole}
          loginEmail={loginEmail}
          jobSeekerProfile={jobSeekerProfile}
          jobSeekerId={jobSeekerId}
          onJobSeekerProfileUpdate={handleJobSeekerProfileUpdate}
          jobSeekerResume={jobSeekerResume}
          onJobSeekerResumeUpdate={handleJobSeekerResumeUpdate}
          jobSeekerSupporting={jobSeekerSupporting}
          onJobSeekerSupportingUpdate={handleJobSeekerSupportingUpdate}
          resumeAttention={resumeAttention}
          onResumeAttentionConsumed={() => setResumeAttention(false)}
        />
      )
    }
    if (activePage === "users" && (isAdmin || isEmployer)) {
      return (
        <UsersPage
          isEmployer={isEmployer}
          currentUser={currentUser || { name: loginEmail, email: loginEmail, role: userRole }}
          onUsersChanged={fetchActivityLogs}
        />
      )
    }
    if (activePage === "archive" && (isAdmin || isEmployer)) {
      return (
        <ArchivePage
          currentUser={currentUser || { name: loginEmail, email: loginEmail, role: userRole }}
          onArchiveChanged={fetchActivityLogs}
        />
      )
    }
    if (activePage === "jobs") {
      return (
        <JobPostingPage
          uploads={uploads}
          isEmployer={isEmployer}
          isJobSeeker={isJobSeeker}
          currentUser={currentUser || { name: loginEmail, email: loginEmail, role: userRole }}
          jobSeekerId={resolvedJobSeekerId}
          jobSeekerResume={jobSeekerResume}
          onViewApplicant={handleViewApplicantFromJobs}
          onDeleteApplicant={handleDelete}
          onJobsChanged={async () => {
            await fetchJobPosts()
            await fetchActivityLogs()
          }}
          onViewJob={(job) => {
            setSelectedJobView(job)
            setActivePage("job-view")
          }}
        />
      )
    }
    if (activePage === "job-view" && isJobSeeker) {
      return (
        <JobViewPage
          job={selectedJobView}
          onBack={() => {
            setSelectedJobView(null)
            setActivePage("jobs")
          }}
          onApply={handleJobSeekerApply}
          onRequireResume={requestResumeAttention}
          jobSeekerProfile={jobSeekerProfile}
          jobSeekerResume={jobSeekerResume}
          jobSeekerSupporting={jobSeekerSupporting}
          jobSeekerId={resolvedJobSeekerId}
          applications={jobSeekerApplications}
        />
      )
    }
    if (viewItem) {
      return (
        <ApplicantViewPage
          viewItem={viewItem}
          onBack={() => {
            setViewItem(null)
            if (isJobSeeker) {
              setActivePage("dashboard")
            }
          }}
          onReanalyze={handleReanalyze}
          readOnly={isJobSeeker}
        />
      )
    }
    if (activePage === "dashboard" && isJobSeeker) {
      return (
        <JobSeekerDashboard
          jobSeekerProfile={jobSeekerProfile}
          uploads={jobSeekerApplications}
          onBrowseJobs={() => handleTopNav("jobs")}
          onViewApplication={(item) => {
            setViewItem(item)
          }}
          onDeleteApplication={(id) => handleDelete(id, "application")}
        />
      )
    }
    if (activePage === "dashboard" && !isJobSeeker) {
      return (
        <DashboardPage
          dashboardData={dashboardData}
          activityLogs={activityLogs}
          onViewAllJobs={() => handleTopNav("jobs")}
          onViewAllApplicants={() => handleTopNav("applicants")}
          onViewApplicant={(item) => {
            setViewItem(item)
            setActivePage("applicants")
            recordActivity({
              event: "application.viewed",
              description: `Viewed application summary for ${item.name || "Applicant"}.`,
              subjectType: "application",
              subjectId: item.id,
              subjectName: item.name || "Applicant",
              metadata: {
                jobTitle: item.applied_job_title || item.matched_job_title || "-"
              }
            })
          }}
        />
      )
    }
    if (activePage === "ratings" && !isJobSeeker) {
      return (
        <RatingsPage
          uploads={uploads}
          isLoading={isLoadingUploads}
          currentUser={currentUser || { name: loginEmail, email: loginEmail, role: userRole }}
          onRatingsChanged={async () => {
            await fetchUploads({ silent: true })
            await fetchActivityLogs()
          }}
        />
      )
    }
    if (activePage === "help") {
      return (
        <HelpPage
          isJobSeeker={isJobSeeker}
          jobSeekerId={resolvedJobSeekerId}
          jobSeekerProfile={jobSeekerProfile}
          jobSeekerResume={jobSeekerResume}
          jobSeekerSupporting={jobSeekerSupporting}
          jobSeekerApplications={jobSeekerApplications}
          onOpenSetupGuide={openJobSeekerSetupGuide}
          onGoToPage={handleTopNav}
        />
      )
    }
    if (isLoadingUploads && !isJobSeeker) {
      return <p>Loading uploads...</p>
    }
    if (displayedUploads.length === 0 && !isJobSeeker) {
      return (
        <section className="empty-state">
          <h3>No applicants found</h3>
          <p>Upload resume to analyze and rank candidates.</p>
        </section>
      )
    }
    if (!isJobSeeker) {
      return (
        <div className="table-wrap">
          <table className="records-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Applicant</th>
                <th>Phone</th>
                <th>Job Applied</th>
                <th>Score</th>
                <th>Classification</th>
                <th>Uploaded File</th>
                <th>Uploaded At</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedUploads.map((item, index) => (
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
                  <td>
                    <span className={`table-classification ${getClassificationClass(item.classification)}`}>
                      {item.classification || "-"}
                    </span>
                  </td>
                  <td>{item.original_name}</td>
                  <td>{new Date(item.uploaded_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</td>
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
      )
    }
    return null
  })()

  // UI rendering
  return (
    <>
    <main className="page" ref={pageRef}>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => handleTopNav("dashboard")}>
          <img src={brandLogo} alt="LNU-HiRe" />
          <span className="brand-copy">
            <span className="brand-name">LNU-HiRe</span>
            {/* <span className="brand-tagline">AI recruitment platform</span> */}
          </span>
        </button>
        <nav className="topnav">
          <button
            type="button"
            className={`topnav-link ${activePage === "dashboard" ? "active" : ""}`}
            onClick={() => handleTopNav("dashboard")}
          >
            <span className="topnav-icon topnav-icon-dashboard" aria-hidden="true" />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`topnav-link ${activePage === "jobs" ? "active" : ""}`}
            onClick={() => handleTopNav("jobs")}
          >
            <span className="topnav-icon topnav-icon-jobs" aria-hidden="true" />
            <span>Jobs</span>
          </button>
          {!isJobSeeker && (
            <button
              type="button"
              className={`topnav-link ${activePage === "applicants" ? "active" : ""}`}
              onClick={() => {
                setShowTopApplicants(false)
                handleTopNav("applicants")
              }}
            >
              <span className="topnav-icon topnav-icon-applicants" aria-hidden="true" />
              <span>Applicants</span>
            </button>
          )}
          {!isJobSeeker && (
            <button
              type="button"
              className={`topnav-link ${activePage === "ratings" ? "active" : ""}`}
              onClick={() => handleTopNav("ratings")}
            >
              <span className="topnav-icon topnav-icon-ratings" aria-hidden="true" />
              <span>Ratings / Evaluation</span>
            </button>
          )}
          <button
            type="button"
            className={`topnav-link ${activePage === "profile" ? "active" : ""}`}
            onClick={() => handleTopNav("profile")}
          >
            <span className="topnav-icon topnav-icon-profile" aria-hidden="true" />
            <span>Profile</span>
          </button>
          <span className="topnav-section-label">Additional Settings</span>
          {(isAdmin || isEmployer) && (
            <button
              type="button"
              className={`topnav-link ${activePage === "users" ? "active" : ""}`}
              onClick={() => handleTopNav("users")}
            >
              <span className="topnav-icon topnav-icon-users" aria-hidden="true" />
              <span>Users</span>
            </button>
          )}
          {(isAdmin || isEmployer) && (
            <button
              type="button"
              className={`topnav-link ${activePage === "archive" ? "active" : ""}`}
              onClick={() => handleTopNav("archive")}
            >
              <span className="topnav-icon topnav-icon-archive" aria-hidden="true" />
              <span>Archive</span>
            </button>
          )}
          <button
            type="button"
            className={`topnav-link ${activePage === "help" ? "active" : ""}`}
            onClick={() => handleTopNav("help")}
          >
            <span className="topnav-icon topnav-icon-help" aria-hidden="true" />
            <span>Help</span>
          </button>
          <div className="notifications-menu sidebar-notifications" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`topnav-link sidebar-notification-link ${hasUnreadNotifications ? "has-unread" : ""}`}
              title="Notifications"
              onClick={(e) => {
                e.stopPropagation()
                setIsNotificationsOpen((prev) => !prev)
              }}
            >
              <span className="topnav-icon topnav-icon-notifications" aria-hidden="true" />
              <span>Notifications</span>
            </button>
          </div>
        </nav>
        <div className="topbar-right">
          <div className="notifications-menu topbar-notifications" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`topbar-bell ${hasUnreadNotifications ? "has-unread" : ""}`}
              title="Notifications"
              onClick={(e) => {
                e.stopPropagation()
                setIsNotificationsOpen((prev) => !prev)
              }}
            >
              <img src={bellIcon} alt="Notifications" />
            </button>
            {isNotificationsOpen && (
              <div className="notifications-dropdown">
                <div className="notifications-header">
                  <div>
                    <h4>{isJobSeeker ? "My Job Applications" : "New Applicants"}</h4>
                    {isJobSeeker && (
                      <p>View and manage your job applications and track their status here.</p>
                    )}
                    {!isJobSeeker && (
                      <p>Recent applicants added by employers or submitted by job seekers.</p>
                    )}
                  </div>
                  <div className="notifications-header-actions">
                    <button
                      type="button"
                      className="notifications-mark-read"
                      onClick={() => {
                        if (isJobSeeker) {
                          markNotificationsRead(unreadJobSeekerApplications.map((item) => item.id))
                        } else {
                          markNotificationsRead(adminNotifications.map((item) => item.id))
                        }
                      }}
                      disabled={isJobSeeker ? unreadJobSeekerApplications.length === 0 : adminNotifications.length === 0}
                    >
                      Mark all as read
                    </button>
                  </div>
                </div>
                {isJobSeeker ? (
                  <>
                    <div className="notifications-controls">
                      <input
                        type="text"
                        className="notifications-search"
                        placeholder="Search jobs..."
                        value={notificationSearch}
                        onChange={(e) => setNotificationSearch(e.target.value)}
                      />
                      <select
                        className="notifications-select"
                        value={notificationStatus}
                        onChange={(e) => setNotificationStatus(e.target.value)}
                      >
                        <option value="all">All Status</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Moderately Qualified">Moderately Qualified</option>
                        <option value="Not Qualified">Not Qualified</option>
                        <option value="Under Review">Under Review</option>
                      </select>
                    </div>
                    <div className="notifications-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Job Title</th>
                            <th>Department</th>
                            <th>Date Applied</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredNotifications.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="notifications-empty">
                                No applications found.
                              </td>
                            </tr>
                          ) : (
                            pagedNotifications.map((item) => {
                              const jobTitle = item.applied_job_title || item.matched_job_title || "-"
                              const department = jobTitleMeta.get(jobTitle)?.department || "-"
                              const status = getApplicationStatus(item)
                              const dateLabel = (() => {
                                const d = new Date(item.uploaded_at)
                                if (Number.isNaN(d.getTime())) return "-"
                                return d.toLocaleDateString(undefined, {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric"
                                })
                              })()
                              return (
                                <tr key={`${item.id}-${jobTitle}`}>
                                  <td>{jobTitle}</td>
                                  <td>{department}</td>
                                  <td>{dateLabel}</td>
                                  <td>
                                    <span className={`notification-status status-${status.toLowerCase().replace(/\s+/g, "-")}`}>
                                      {status}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="notifications-footer">
                      <span>
                        {filteredNotifications.length === 0
                          ? "Showing 0 to 0 of 0 entries"
                          : `Showing ${(notificationPage - 1) * NOTIFICATIONS_PER_PAGE + 1} to ${Math.min(
                            notificationPage * NOTIFICATIONS_PER_PAGE,
                            filteredNotifications.length
                          )} of ${filteredNotifications.length} entries`}
                      </span>
                      <div className="notifications-pagination">
                        <button
                          type="button"
                          disabled={notificationPage === 1}
                          onClick={() => setNotificationPage((prev) => Math.max(1, prev - 1))}
                        >
                          Previous
                        </button>
                        {Array.from({ length: notificationPageCount }, (_, index) => {
                          const pageNumber = index + 1
                          return (
                            <button
                              key={`notification-page-${pageNumber}`}
                              type="button"
                              className={notificationPage === pageNumber ? "is-active" : ""}
                              onClick={() => setNotificationPage(pageNumber)}
                            >
                              {pageNumber}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          disabled={notificationPage === notificationPageCount}
                          onClick={() => setNotificationPage((prev) => Math.min(notificationPageCount, prev + 1))}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="notifications-admin-list">
                    {adminNotifications.length === 0 ? (
                      <div className="notifications-empty-block">No new applicants yet.</div>
                    ) : (
                      pagedAdminNotifications.map((item) => {
                        const jobTitle = item.applied_job_title || item.matched_job_title || "-"
                        const status = getApplicationStatus(item)
                        const dateLabel = (() => {
                          const d = new Date(item.uploaded_at)
                          if (Number.isNaN(d.getTime())) return "-"
                          return d.toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                            year: "numeric"
                          })
                        })()
                        return (
                          <div key={`${item.id}-${jobTitle}`} className="notifications-admin-item">
                            <div>
                              <div className="notifications-admin-title">{item.name || "Applicant"}</div>
                              <div className="notifications-admin-sub">
                                {jobTitle} · {dateLabel}
                              </div>
                            </div>
                            <span className={`notification-status status-${status.toLowerCase().replace(/\s+/g, "-")}`}>
                              {status}
                            </span>
                          </div>
                        )
                      })
                    )}
                    {adminNotifications.length > 0 && (
                      <div className="notifications-footer">
                        <span>
                          {`Showing ${(adminNotificationPage - 1) * NOTIFICATIONS_PER_PAGE + 1} to ${Math.min(
                            adminNotificationPage * NOTIFICATIONS_PER_PAGE,
                            adminNotifications.length
                          )} of ${adminNotifications.length} entries`}
                        </span>
                        <div className="notifications-pagination">
                          <button
                            type="button"
                            disabled={adminNotificationPage === 1}
                            onClick={() => setAdminNotificationPage((prev) => Math.max(1, prev - 1))}
                          >
                            Previous
                          </button>
                          {Array.from({ length: adminNotificationPageCount }, (_, index) => {
                            const pageNumber = index + 1
                            return (
                              <button
                                key={`admin-notification-page-${pageNumber}`}
                                type="button"
                                className={adminNotificationPage === pageNumber ? "is-active" : ""}
                                onClick={() => setAdminNotificationPage(pageNumber)}
                              >
                                {pageNumber}
                              </button>
                            )
                          })}
                          <button
                            type="button"
                            disabled={adminNotificationPage === adminNotificationPageCount}
                            onClick={() => setAdminNotificationPage((prev) => Math.min(adminNotificationPageCount, prev + 1))}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="profile-menu" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="topbar-profile sidebar-logout"
              title="Logout"
              onClick={(e) => {
                e.stopPropagation()
                handleLogout()
              }}
            >
              <span className="sidebar-logout-icon" aria-hidden="true">↗</span>
              <span className="sidebar-logout-copy">
                <span className="sidebar-logout-role">
                  {userRole === "admin" ? "HR Personnel" : userRole === "jobseeker" ? "Job Seeker" : "Employer"}
                </span>
                <span className="sidebar-logout-label">Logout</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      {showJobSeekerSetupGuide && isJobSeeker && (
        <div
          className="modal-overlay jobseeker-setup-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeJobSeekerSetupGuide()
            }
          }}
        >
          <div className="modal-card jobseeker-setup-modal" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const currentStep = jobSeekerSetupGuideSteps[jobSeekerSetupStep] || jobSeekerSetupGuideSteps[0]
              const isLastStep = jobSeekerSetupStep === jobSeekerSetupGuideSteps.length - 1
              return (
              <>
            <div className="jobseeker-setup-head">
              <div>
                <span className="jobseeker-setup-kicker">Account Setup</span>
                <h3>Step-by-step account guide</h3>
              </div>
              <button type="button" className="close-x" onClick={closeJobSeekerSetupGuide}>×</button>
            </div>
            <p className="jobseeker-setup-intro">
              Follow each step to set up your profile, discover the pages, and understand where to go next.
            </p>

            <div className="jobseeker-setup-wizard-progress" aria-label={`Step ${jobSeekerSetupStep + 1} of ${jobSeekerSetupGuideSteps.length}`}>
              {jobSeekerSetupGuideSteps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  className={index === jobSeekerSetupStep ? "active" : index < jobSeekerSetupStep ? "done" : ""}
                  onClick={() => setJobSeekerSetupStep(index)}
                  aria-label={`Go to step ${index + 1}: ${step.title}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className="jobseeker-setup-wizard-card">
              <span className="jobseeker-setup-step">{jobSeekerSetupStep + 1}</span>
              <div>
                <strong>{currentStep.title}</strong>
                <p>{currentStep.body}</p>
                <small>{currentStep.detail}</small>
              </div>
            </div>

            <div className="modal-actions jobseeker-setup-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={jobSeekerSetupStep === 0}
                onClick={() => setJobSeekerSetupStep((prev) => Math.max(0, prev - 1))}
              >
                Back
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (!isLastStep) {
                    setJobSeekerSetupStep((prev) => Math.min(jobSeekerSetupGuideSteps.length - 1, prev + 1))
                    return
                  }
                  closeJobSeekerSetupGuide()
                }}
              >
                {isLastStep ? "Finish Guide" : "Next Step"}
              </button>
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (currentStep.page === "profile") {
                    goToJobSeekerSetupProfile()
                    return
                  }
                  closeJobSeekerSetupGuide()
                  handleTopNav(currentStep.page)
                }}
              >
                Open {currentStep.page === "jobs" ? "Jobs" : currentStep.page === "dashboard" ? "Dashboard" : "Profile"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeJobSeekerSetupGuide}>
                Later
              </button>
            </div>
            </>
              )
            })()}
          </div>
        </div>
      )}

      {activeJobSeekerPageIntro && isJobSeeker && !showJobSeekerSetupGuide && (
        <div
          className="modal-overlay jobseeker-page-intro-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeJobSeekerPageIntro()
            }
          }}
        >
          <div className="modal-card jobseeker-page-intro-modal" onClick={(e) => e.stopPropagation()}>
            <div className="jobseeker-setup-head">
              <div>
                <span className="jobseeker-setup-kicker">About This Page</span>
                <h3>{jobSeekerPageIntros[activeJobSeekerPageIntro].title}</h3>
              </div>
              <button type="button" className="close-x" onClick={closeJobSeekerPageIntro}>×</button>
            </div>
            <p className="jobseeker-setup-intro">
              {jobSeekerPageIntros[activeJobSeekerPageIntro].body}
            </p>
            <div className="jobseeker-page-intro-tips">
              {jobSeekerPageIntros[activeJobSeekerPageIntro].tips.map((tip) => (
                <div key={tip}>
                  <span aria-hidden="true">•</span>
                  <p>{tip}</p>
                </div>
              ))}
            </div>
            <div className="modal-actions jobseeker-setup-actions">
              <button type="button" className="btn" onClick={closeJobSeekerPageIntro}>
                Continue
              </button>
              {activeJobSeekerPageIntro !== "help" && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    closeJobSeekerPageIntro()
                    handleTopNav("help")
                  }}
                >
                  Open Help
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId != null && (
        <div
          className="modal-overlay delete-confirm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmDeleteId(null)
            }
          }}
        >
          <div className="modal-card delete-confirm-card">
            <h3>{confirmDeleteContext === "applicant" ? "Delete Applicant" : "Delete Application"}</h3>
            <p>
              {confirmDeleteContext === "applicant"
                ? "Are you sure you want to delete this applicant? This action cannot be undone."
                : "Are you sure you want to delete this application? This action cannot be undone."
              }
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  const idToDelete = confirmDeleteId
                  setConfirmDeleteId(null)
                  if (idToDelete != null) {
                    if (isJobSeeker && confirmDeleteContext !== "applicant") {
                      await performHideApplication(idToDelete)
                    } else {
                      await performDelete(idToDelete)
                    }
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {activePage === "applicants" && !viewItem && !isJobSeeker && (
        <section className="panel applicants-panel">
          <div className="applicants-hero">
            <div>
              <h2 className="title">Applicants</h2>
              <p className="subtitle">View and manage all job applicants ranked by qualifications</p>
            </div>
          </div>

          <div className="filters applicants-filters">
            <input
              className="input"
              type="text"
              placeholder="Search..."
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

          <div className="panel-meta applicants-meta">
            <p>
              {showTopApplicants
                ? `Showing ${displayedUploads.length} of ${uploads.length} applicants (Top 10 by score)`
                : `Showing ${displayedUploads.length} of ${uploads.length} applicants`}
            </p>
            <div className="sort-wrap applicants-sort">
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
              <button
                type="button"
                className={`sort-btn ${showTopApplicants ? "active" : ""}`}
                onClick={() => setShowTopApplicants((prev) => !prev)}
              >
                {showTopApplicants ? "Show All" : "Top 10 by Score"}
              </button>
            </div>
          </div>
        </section>
      )}

      {activePage === "applicants" && isUploadModalOpen && !isJobSeeker && (
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
                  placeholder=""
                />
              </div>
            </div>

            <div className="field-group">
              <label>Job Post Applied</label>
              <div className="autocomplete" onClick={(e) => e.stopPropagation()}>
                <input
                  className="input"
                  type="text"
                  value={appliedJobTitle}
                  onChange={(e) => {
                    setAppliedJobTitle(e.target.value)
                    setIsAppliedJobOpen(true)
                  }}
                  onFocus={() => setIsAppliedJobOpen(true)}
                  placeholder="Select a job post"
                />
                {isAppliedJobOpen && appliedJobSuggestions.length > 0 && appliedJobTitle && (
                  <div className="autocomplete-menu">
                    {appliedJobSuggestions
                      .filter((title) => title.toLowerCase().includes(appliedJobTitle.trim().toLowerCase()))
                      .slice(0, 8)
                      .map((title) => (
                        <button
                          key={`applied-job-${title}`}
                          type="button"
                          className="autocomplete-item"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setAppliedJobTitle(title)
                            setIsAppliedJobOpen(false)
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

      {deleteToast && (
        <div className={`toast ${deleteToast.type === "success" ? "toast-success" : "toast-fail"}`}>
          {deleteToast.message}
        </div>
      )}

      {mainContent}

      {summaryItem && (
        <div
          style={{
            position: "fixed",
            left: "-10000px",
            top: 0,
            width: "794px",
            padding: "12px",
            background: "#ffffff",
            zIndex: -1
          }}
        >
          <div ref={summaryRef}>
            <section className="candidate-page candidate-page-export">
              <div className="candidate-head">
                <div>
                  <h2 className="candidate-name">{summaryItem?.name || "(No name)"}</h2>
                  <p className="candidate-role">
                    Applied for <strong>{summaryItem?.applied_job_title || summaryItem?.matched_job_title || "No matched role yet"}</strong>
                  </p>
                </div>
              </div>

              <div className="candidate-layout">
                <div className="candidate-left">
                  <section className="candidate-card">
                    <h3>Contact Information</h3>
                    <p>{summaryItem?.email || "No email"}</p>
                    <p>{summaryItem?.phone || "No phone"}</p>
                    <p>{summaryItem?.original_name || "-"}</p>
                  </section>

                  <section className="candidate-card">
                    <h3>Supporting Documents</h3>
                    {summarySupportingError && <p className="muted">{summarySupportingError}</p>}
                    {!summarySupportingError && summarySupportingFiles.length === 0 && (
                      <p className="muted">No supporting documents uploaded.</p>
                    )}
                    {summarySupportingFiles.length > 0 && (
                      <div className="supporting-docs-list">
                        {summarySupportingFiles.map((file) => (
                          <p key={`summary-support-${file.id || file.saved_name || file.original_name}`}>
                            {file.original_name || "Supporting document"}
                          </p>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="candidate-card">
                    <h3>Skills</h3>
                    <p className="card-note">Extracted from resume using NLP analysis</p>
                    <div className="skills-cloud">
                      {summaryMatchedSkills.length ? (
                        summaryMatchedSkills.map((skill) => (
                          <span key={skill} className="skill-pill">{skill}</span>
                        ))
                      ) : (
                        <span className="muted">No matched skills found.</span>
                      )}
                    </div>
                  </section>

                  <section className="candidate-card">
                    <h3>Education</h3>
                    {summaryEducation.length ? (
                      summaryEducation.map((line, idx) => (
                        <p key={`${line}-${idx}`}>{line}</p>
                      ))
                    ) : (
                      <p className="muted">No education data extracted.</p>
                    )}
                  </section>

                  <section className="candidate-card">
                    <h3>Work Experience</h3>
                    {summaryExperience.length ? (
                      summaryExperience.map((line, idx) => (
                        <p key={`${line}-${idx}`}>{line}</p>
                      ))
                    ) : (
                      <p className="muted">No clear work experience extracted.</p>
                    )}
                  </section>
                </div>

                <div className="candidate-right">
                  <section className="candidate-card">
                    <h3>Qualification Status</h3>
                    <p className={`status-chip ${(summaryItem?.classification || "").toLowerCase().replace(/\s+/g, "-")}`}>
                      {summaryItem?.classification || "Not Qualified"}
                    </p>
                    <div className="overall-box">
                      <p className="overall-score">{`${summaryOverall.toFixed(0)}%`}</p>
                      <p>Overall Match Score</p>
                    </div>
                  </section>

                  <section className="candidate-card">
                    <h3>Match Score Breakdown</h3>
                    <div className="breakdown-list">
                      <div className="bar-row">
                        <div className="bar-label"><span>Overall Match</span><strong>{summaryOverall.toFixed(0)}%</strong></div>
                        <div className="bar"><div style={{ width: `${summaryOverall}%` }} /></div>
                      </div>
                      <div className="bar-row">
                        <div className="bar-label"><span>Skills Match</span><strong>{summarySkillsMatch}%</strong></div>
                        <div className="bar"><div style={{ width: `${summarySkillsMatch}%` }} /></div>
                      </div>
                      <div className="bar-row">
                        <div className="bar-label"><span>Education Match</span><strong>{summaryEducationMatch}%</strong></div>
                        <div className="bar"><div style={{ width: `${summaryEducationMatch}%` }} /></div>
                      </div>
                      <div className="bar-row">
                        <div className="bar-label"><span>Experience Match</span><strong>{summaryExperienceMatch}%</strong></div>
                        <div className="bar"><div style={{ width: `${summaryExperienceMatch}%` }} /></div>
                      </div>
                    </div>
                  </section>

                  <section className="candidate-card">
                    <h3>Missing Skills</h3>
                    {summaryMissingSkills.length ? (
                      <div className="skills-cloud">
                        {summaryMissingSkills.map((skill) => (
                          <span key={`missing-${skill}`} className="skill-pill">{skill}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No missing skills detected.</p>
                    )}
                  </section>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {activePage === "applicants" && actionsMenu && !isJobSeeker && (
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
          <button
            type="button"
            className="actions-menu-item"
            onClick={() => {
              downloadApplicantSummaryPdf(actionsMenu.item)
              setActionsMenu(null)
            }}
          >
            Download Summary (PDF)
          </button>
          <button
            type="button"
            className="actions-menu-item"
            disabled={Boolean(actionsMenu.item?.ratingCount || actionsMenu.item?.rating_count)}
            onClick={() => {
              const status = String(actionsMenu.item?.evaluation_status || actionsMenu.item?.evaluationStatus || "").toLowerCase()
              const hasRating = Boolean(actionsMenu.item?.ratingCount || actionsMenu.item?.rating_count)
              if (hasRating) return
              if (status === "for_evaluation" || status === "rated") {
                setActionsMenu(null)
                handleTopNav("ratings")
                return
              }
              markApplicantForInterview(actionsMenu.item)
            }}
          >
            {actionsMenu.item?.ratingCount || actionsMenu.item?.rating_count
              ? "Rated"
              : String(actionsMenu.item?.evaluation_status || actionsMenu.item?.evaluationStatus || "").toLowerCase() === "for_evaluation"
                ? "Rating"
                : String(actionsMenu.item?.evaluation_status || actionsMenu.item?.evaluationStatus || "").toLowerCase() === "rated"
                  ? "Rated"
                  : "Interview"}
          </button>
          <button
            type="button"
            className="actions-menu-item danger"
            onClick={() => {
              const itemId = actionsMenu.item.id
              setActionsMenu(null)
              handleDelete(itemId, "applicant")
            }}
          >
            Delete
          </button>
        </div>
      )}

    </main>
    <button
      type="button"
      className={`back-to-top ${isAuthenticated && activePage !== "job-view" && showBackToTop ? "visible" : ""}`}
      onClick={scrollBackToTop}
      aria-label="Back to top"
      title="Back to top"
    >
      <span aria-hidden="true">↑</span>
    </button>
    </>
  )
}

export default App
