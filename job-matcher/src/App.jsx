// React imports
import { useCallback, useEffect, useMemo, useState } from 'react'
import './AppLayout.css'
import LoginPage from './LoginPage'
import ApplicantViewPage from './ApplicantViewPage'
import JobPostingPage from './JobPostingPage'
import DashboardPage from './DashboardPage'
import JobSeekerDashboard from './JobSeekerDashboard'
import JobViewPage from './JobViewPage'
import ProfilePage from './ProfilePage'
import RegisterPage from './RegisterPage'
import CustomDropdown from './CustomDropdown'
import profileIcon from './assets/circle-user-solid-full.svg'
import bellIcon from './assets/bell-solid-full.svg'
import appLogo from './assets/Logo.png'

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
  const [activePage, setActivePage] = useState(() => localStorage.getItem("activePage") || "applicants")
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem("isAuthenticated") === "true")
  const [userRole, setUserRole] = useState(() => localStorage.getItem("userRole") || "")
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)
  const [jobSeekerProfile, setJobSeekerProfile] = useState(() => {
    const stored = localStorage.getItem("jobSeekerProfile")
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  })
  const [jobSeekerId, setJobSeekerId] = useState(() => {
    const stored = localStorage.getItem("jobSeekerId")
    return stored ? Number(stored) : null
  })
  const handleJobSeekerProfileUpdate = useCallback((profile) => {
    setJobSeekerProfile(profile)
    localStorage.setItem("jobSeekerProfile", JSON.stringify(profile))
  }, [])
  const [registerFullName, setRegisterFullName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerUsername, setRegisterUsername] = useState("")
  const [registerPhone, setRegisterPhone] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("")
  const [registerError, setRegisterError] = useState("")
  const [uploadStatus, setUploadStatus] = useState("")
  const [uploadNotice, setUploadNotice] = useState("")
  const [appliedJobTitle, setAppliedJobTitle] = useState("")
  const [isAppliedJobOpen, setIsAppliedJobOpen] = useState(false)
  const [jobFilter, setJobFilter] = useState("all")
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notificationSearch, setNotificationSearch] = useState("")
  const [notificationStatus, setNotificationStatus] = useState("all")
  const [readNotificationIds, setReadNotificationIds] = useState([])
  const [selectedJobView, setSelectedJobView] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmDeleteContext, setConfirmDeleteContext] = useState("application")
  const isEmployer = userRole === "employer"
  const isJobSeeker = userRole === "jobseeker"
  const normalizedPhone = phone.length ? `+63${phone}` : ""

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
    if (!isAuthenticated) return
    localStorage.setItem("activePage", activePage)
  }, [activePage, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    if (userRole === "jobseeker" && activePage !== "jobs" && activePage !== "profile" && activePage !== "dashboard" && activePage !== "job-view") {
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
      setActivePage("dashboard")
      setLoginError("")
      setLoginPassword("")
      return
    }

    try {
      const response = await fetch("http://localhost:5000/job-seekers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: loginEmail.trim(),
          password: loginPassword
        })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Invalid email or password.")
      }
      const payload = await response.json()
      setIsAuthenticated(true)
      localStorage.setItem("isAuthenticated", "true")
      setUserRole("jobseeker")
      localStorage.setItem("userRole", "jobseeker")
      setActivePage("dashboard")
      if (payload) {
        setJobSeekerProfile(payload)
        localStorage.setItem("jobSeekerProfile", JSON.stringify(payload))
        if (payload.id != null) {
          setJobSeekerId(payload.id)
          localStorage.setItem("jobSeekerId", String(payload.id))
        }
        setLoginEmail(payload.email || loginEmail)
      }
      setLoginError("")
      setLoginPassword("")
    } catch (err) {
      setLoginError(err.message || "Invalid email or password.")
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!registerFullName.trim() || !registerUsername.trim() || !registerEmail.trim() || !registerPhone.trim() || !registerPassword.trim()) {
      setRegisterError("Please fill in all fields.")
      return
    }
    if (registerPassword !== registerConfirmPassword) {
      setRegisterError("Passwords do not match.")
      return
    }
    setRegisterError("")
    try {
      const response = await fetch("http://localhost:5000/job-seekers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: registerFullName.trim(),
          username: registerUsername.trim(),
          email: registerEmail.trim(),
          phone: registerPhone.trim(),
          password: registerPassword
        })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "Registration failed.")
      }
      setRegisterFullName("")
      setRegisterUsername("")
      setRegisterEmail("")
      setRegisterPhone("")
      setRegisterPassword("")
      setRegisterConfirmPassword("")
      setIsRegistering(false)
    } catch (err) {
      setRegisterError(err.message || "Registration failed.")
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem("isAuthenticated")
    setUserRole("")
    localStorage.removeItem("userRole")
    localStorage.removeItem("activePage")
    localStorage.removeItem("jobSeekerProfile")
    localStorage.removeItem("jobSeekerId")
    setActionsMenu(null)
    setIsProfileMenuOpen(false)
    setViewItem(null)
    setJobSeekerProfile(null)
    setJobSeekerId(null)
    setActivePage("applicants")
  }

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

  const handleJobSeekerApply = async ({ name: applicantName, email: applicantEmail, phone: applicantPhone, file: resumeFile, appliedJobTitle }) => {
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

    if (!normalizedName || !normalizedEmail || !normalizedPhone || !normalizedJobTitle) {
      return { ok: false, message: "Please fill in all fields." }
    }
    if (!/^\d{10}$/.test(normalizedPhone)) {
      return { ok: false, message: "Phone number must be exactly 10 digits after +63." }
    }
    if (!resumeFile) {
      return { ok: false, message: "Please upload a resume/CV file." }
    }

    const formData = new FormData()
    formData.append("name", normalizedName)
    formData.append("email", normalizedEmail)
    formData.append("phone", `+63${normalizedPhone}`)
    formData.append("appliedJobTitle", normalizedJobTitle)
    formData.append("file", resumeFile)

    try {
      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.message || "Failed to submit application."
        showUploadNotice("fail", message)
        return { ok: false, message }
      }

      showUploadNotice("success", "Application submitted successfully.")
      await fetchUploads({ silent: true })
      await fetchJobPosts()
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
  const appliedJobSuggestions = activeJobPosts.map((job) => String(job.title || "").trim()).filter(Boolean)

  const dashboardData = useMemo(() => {
    const normalize = (value) => String(value || "").trim().toLowerCase()

    let highlyQualified = 0
    let moderatelyQualified = 0
    let notQualified = 0
    let scoreSum = 0
    let scoreCount = 0

    uploads.forEach((item) => {
      const cls = normalize(item.classification)
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

    const topJobsByApplicants = [...jobPosts]
      .map((job) => ({ title: job.title, applicants: Number(job.applicants || 0) }))
      .sort((a, b) => b.applicants - a.applicants)
      .slice(0, 5)

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
      const key = monthKey(item.uploaded_at)
      if (!key || !monthIndex.has(key)) return
      applicantsByMonth[monthIndex.get(key)].count += 1
    })

    return {
      openJobs: jobPosts.filter((job) => String(job.status || "active").toLowerCase() === "active").length,
      totalApplicants: uploads.length,
      highlyQualified,
      moderatelyQualified,
      notQualified,
      recentApplicants,
      recentJobs,
      averageScore,
      scoreBuckets,
      topJobsByApplicants,
      applicantsByMonth
    }
  }, [uploads, jobPosts])

  const getClassificationClass = (value) =>
    String(value || "").toLowerCase().replace(/\s+/g, "-")

  const getApplicationStatus = (item) => {
    const cls = String(item?.classification || "").toLowerCase()
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

  const adminNotifications = useMemo(() => {
    if (isJobSeeker) return []
    return [...uploads]
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      .filter((item) => !readNotificationIds.includes(item.id))
      .slice(0, 6)
  }, [uploads, isJobSeeker, readNotificationIds])

  const hasUnreadNotifications = isJobSeeker
    ? unreadJobSeekerApplications.length > 0
    : adminNotifications.length > 0

  if (!isAuthenticated) {
    if (isRegistering) {
      return (
        <RegisterPage
          fullName={registerFullName}
          setFullName={setRegisterFullName}
          username={registerUsername}
          setUsername={setRegisterUsername}
          email={registerEmail}
          setEmail={setRegisterEmail}
          phone={registerPhone}
          setPhone={setRegisterPhone}
          password={registerPassword}
          setPassword={setRegisterPassword}
          confirmPassword={registerConfirmPassword}
          setConfirmPassword={setRegisterConfirmPassword}
          registerError={registerError}
          onSubmit={handleRegister}
          onBack={() => setIsRegistering(false)}
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
        onSubmit={handleLogin}
        onRegister={() => setIsRegistering(true)}
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
        />
      )
    }
    if (activePage === "jobs") {
      return (
        <JobPostingPage
          uploads={uploads}
          isEmployer={isEmployer}
          isJobSeeker={isJobSeeker}
          onViewApplicant={handleViewApplicantFromJobs}
          onDeleteApplicant={handleDelete}
          onJobsChanged={fetchJobPosts}
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
          onBack={() => setActivePage("jobs")}
          onApply={handleJobSeekerApply}
          jobSeekerProfile={jobSeekerProfile}
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
          uploads={uploads}
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
          onViewAllJobs={() => handleTopNav("jobs")}
          onViewAllApplicants={() => handleTopNav("applicants")}
          onViewApplicant={(item) => {
            setViewItem(item)
            setActivePage("applicants")
          }}
        />
      )
    }
    if (isLoadingUploads && !isJobSeeker) {
      return <p>Loading uploads...</p>
    }
    if (filteredUploads.length === 0 && !isJobSeeker) {
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
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <img src={appLogo} alt="LNU RecruitIQ" />
        </div>
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
          {!isJobSeeker && (
            <button
              type="button"
              className={`topnav-link ${activePage === "applicants" ? "active" : ""}`}
              onClick={() => handleTopNav("applicants")}
            >
              Applicant
            </button>
          )}
        </nav>
        <div className="topbar-right">
          <div className="notifications-menu" onClick={(e) => e.stopPropagation()}>
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
                    {isJobSeeker && (
                      <div className="notifications-header-search">
                        <input
                          type="text"
                          className="notifications-search"
                          placeholder="Search jobs..."
                          value={notificationSearch}
                          onChange={(e) => setNotificationSearch(e.target.value)}
                        />
                      </div>
                    )}
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
                            filteredNotifications.map((item) => {
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
                        Showing 1 to {filteredNotifications.length} of {filteredNotifications.length} entries
                      </span>
                      <div className="notifications-pagination">
                        <button type="button" disabled>Previous</button>
                        <button type="button" className="is-active">1</button>
                        <button type="button" disabled>Next</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="notifications-admin-list">
                    {adminNotifications.length === 0 ? (
                      <div className="notifications-empty-block">No new applicants yet.</div>
                    ) : (
                      adminNotifications.map((item) => {
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
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="profile-menu" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="topbar-profile"
              title="Profile"
              onClick={(e) => {
                e.stopPropagation()
                setIsProfileMenuOpen((prev) => !prev)
              }}
            >
              <img src={profileIcon} alt="Profile" className="topbar-profile-icon" />
              <span>
                {userRole === "admin" ? "Admin" : userRole === "jobseeker" ? "Job Seeker" : "Employer"}
              </span>
              <span className="profile-caret">▾</span>
            </button>
            {isProfileMenuOpen && (
              <div className="profile-dropdown">
                <button
                  type="button"
                  className="profile-dropdown-item"
                  onClick={() => {
                    setActivePage("profile")
                    setIsProfileMenuOpen(false)
                  }}
                >
                  Profile
                </button>
                <button type="button" className="profile-dropdown-item" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {confirmDeleteId != null && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmDeleteId(null)
            }
          }}
        >
          <div className="modal-card">
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
                    await performDelete(idToDelete)
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

      {mainContent}

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
              handleDelete(itemId, "applicant")
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
