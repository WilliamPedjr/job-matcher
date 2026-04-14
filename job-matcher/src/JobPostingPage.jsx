import { useEffect, useMemo, useRef, useState } from 'react'
import './JobPostingPage.css'
import CustomDropdown from './CustomDropdown'

function JobPostingPage({ uploads = [], isEmployer = false, isJobSeeker = false, jobSeekerId, jobSeekerResume, onViewApplicant, onDeleteApplicant, onJobsChanged, onViewJob }) {
  const APPLICATION_MATCH_BONUS_PERCENT = 10
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
  const [newJobDepartment, setNewJobDepartment] = useState("")
  const [isJobPositionOpen, setIsJobPositionOpen] = useState(false)
  const [expandedDepartments, setExpandedDepartments] = useState({})
  const defaultJobLocation = "Leyte Normal University"
  const [newJobType, setNewJobType] = useState("Full-time")
  const [newJobStatus, setNewJobStatus] = useState("active")
  const [newRequiredSkills, setNewRequiredSkills] = useState("")
  const [newMinimumEducation, setNewMinimumEducation] = useState("Bachelor's Degree")
  const [newMinimumExperienceYears, setNewMinimumExperienceYears] = useState("0")
  const [newSalaryMin, setNewSalaryMin] = useState("")
  const [newSalaryMax, setNewSalaryMax] = useState("")
  const lastMonthlySalaryRef = useRef(null)
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [createJobStatus, setCreateJobStatus] = useState("")
  const [createJobNotice, setCreateJobNotice] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSkillsOpen, setIsSkillsOpen] = useState(false)
  const [skillDraft, setSkillDraft] = useState("")
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState(null)
  const [jobMatches, setJobMatches] = useState({})
  const [jobMatchStatus, setJobMatchStatus] = useState("idle")
  const [jobSkillCatalog, setJobSkillCatalog] = useState([])
  const [jobSkillStatus, setJobSkillStatus] = useState("idle")
  const [globalSkillCatalog, setGlobalSkillCatalog] = useState([])
  const [globalSkillStatus, setGlobalSkillStatus] = useState("idle")
  const [templateSkillCatalog, setTemplateSkillCatalog] = useState([])
  const [templateSkillStatus, setTemplateSkillStatus] = useState("idle")
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

  const normalizeSalaryRange = (minValue, maxValue) => {
    if (maxValue < minValue) {
      return { salaryMin: minValue, salaryMax: minValue }
    }
    return { salaryMin: minValue, salaryMax: maxValue }
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
    if (!isJobPositionOpen) return
    const onDocClick = () => setIsJobPositionOpen(false)
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [isJobPositionOpen])

  useEffect(() => {
    if (isJobSeeker && isCreateModalOpen) {
      setIsCreateModalOpen(false)
    }
  }, [isJobSeeker, isCreateModalOpen])

  useEffect(() => {
    if (isEditingJob) return
    const title = newJobTitle.trim()
    if (!title) {
      setTemplateSkillCatalog([])
      setTemplateSkillStatus("idle")
      return
    }
    let isMounted = true
    const controller = new AbortController()
    setTemplateSkillStatus("loading")
    const fetchCatalog = async () => {
      try {
        const response = await fetch(`http://localhost:5000/skills/catalog?title=${encodeURIComponent(title)}`, {
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error("Failed to load skill catalog.")
        }
        const payload = await response.json()
        if (!isMounted) return
        setTemplateSkillCatalog(Array.isArray(payload?.skills) ? payload.skills : [])
        setTemplateSkillStatus("ready")
      } catch (error) {
        if (!isMounted || error?.name === "AbortError") return
        setTemplateSkillCatalog([])
        setTemplateSkillStatus("error")
      }
    }
    fetchCatalog()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [isEditingJob, newJobTitle])

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()
    setGlobalSkillStatus("loading")
    const fetchGlobalSkills = async () => {
      try {
        const response = await fetch("http://localhost:5000/skills", { signal: controller.signal })
        if (!response.ok) {
          throw new Error("Failed to load skills.")
        }
        const payload = await response.json()
        if (!isMounted) return
        setGlobalSkillCatalog(Array.isArray(payload?.skills) ? payload.skills : [])
        setGlobalSkillStatus("ready")
      } catch (error) {
        if (!isMounted || error?.name === "AbortError") return
        setGlobalSkillCatalog([])
        setGlobalSkillStatus("error")
      }
    }
    fetchGlobalSkills()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!editingJobId) {
      setJobSkillCatalog([])
      setJobSkillStatus("idle")
      return
    }
    let isMounted = true
    const controller = new AbortController()
    setJobSkillStatus("loading")
    const fetchCatalog = async () => {
      try {
        const response = await fetch(`http://localhost:5000/jobs/${editingJobId}/skills`, {
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error("Failed to load job skills.")
        }
        const payload = await response.json()
        if (!isMounted) return
        setJobSkillCatalog(Array.isArray(payload?.skills) ? payload.skills : [])
        setJobSkillStatus("ready")
      } catch (error) {
        if (!isMounted || error?.name === "AbortError") return
        setJobSkillCatalog([])
        setJobSkillStatus("error")
      }
    }
    fetchCatalog()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [editingJobId])

  useEffect(() => {
    if (!isJobSeeker || !jobSeekerId) {
      setJobMatches({})
      setJobMatchStatus("idle")
      return
    }
    if (!jobSeekerResume) {
      setJobMatches({})
      setJobMatchStatus("no-resume")
      return
    }
    if (!jobs.length) {
      setJobMatches({})
      setJobMatchStatus("idle")
      return
    }

    let isMounted = true
    const controller = new AbortController()
    setJobMatchStatus("loading")

    const fetchMatches = async () => {
      try {
        const results = await Promise.all(
          jobs.map(async (job) => {
            const title = String(job.title || "").trim()
            if (!title) return null
            try {
              const response = await fetch(
                `http://localhost:5000/job-seekers/${jobSeekerId}/resume/match?jobTitle=${encodeURIComponent(title)}`,
                { signal: controller.signal }
              )
              if (!response.ok) {
                return { key: title.toLowerCase(), score: null, qualifies: false }
              }
              const payload = await response.json()
              const score = Number(payload?.matchScore)
              if (Number.isNaN(score)) {
                return { key: title.toLowerCase(), score: null, qualifies: false }
              }
              const minimumScore = Number(payload?.minimumScore ?? 50)
              const normalizedMinimumScore = Number.isFinite(minimumScore) ? minimumScore : 50
              const scoreWithBonus = Math.min(100, score + APPLICATION_MATCH_BONUS_PERCENT)
              return {
                key: title.toLowerCase(),
                score: scoreWithBonus,
                qualifies: scoreWithBonus >= normalizedMinimumScore
              }
            } catch (error) {
              if (error?.name === "AbortError") return null
              return { key: title.toLowerCase(), score: null, qualifies: false }
            }
          })
        )

        if (!isMounted) return
        const next = {}
        results.filter(Boolean).forEach((item) => {
          next[item.key] = { score: item.score, qualifies: item.qualifies }
        })
        setJobMatches(next)
        setJobMatchStatus("ready")
      } catch {
        if (!isMounted) return
        setJobMatches({})
        setJobMatchStatus("error")
      }
    }

    fetchMatches()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [isJobSeeker, jobSeekerId, jobSeekerResume, jobs])

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

  const jobCategoryGroups = useMemo(() => {
    const map = new Map()
    const sources = [
      ...templates.map((item) => ({ ...item, source: "template" })),
      ...jobs.map((item) => ({ ...item, source: "job" }))
    ]
    sources.forEach((item) => {
      const title = String(item.title || "").trim()
      if (!title) return
      const department = String(item.department || "Other").trim() || "Other"
      if (!map.has(department)) {
        map.set(department, new Set())
      }
      map.get(department).add(title)
    })
    return Array.from(map.entries())
      .map(([department, titles]) => ({
        department,
        titles: Array.from(titles).sort((a, b) => a.localeCompare(b))
      }))
      .sort((a, b) => a.department.localeCompare(b.department))
  }, [jobs, templates])

  const filteredJobCategoryGroups = useMemo(() => {
    const query = newJobTitle.trim().toLowerCase()
    if (!query) return jobCategoryGroups
    return jobCategoryGroups
      .map((group) => ({
        department: group.department,
        titles: group.titles.filter((title) => title.toLowerCase().includes(query))
      }))
      .filter((group) => group.titles.length > 0)
  }, [jobCategoryGroups, newJobTitle])

  const jobPositionLabel = useMemo(() => {
    if (!newJobTitle) return ""
    return newJobTitle
  }, [newJobTitle])

  const searchSuggestions = useMemo(() => {
    const tokens = [
      ...jobs.map((job) => String(job.title || "").trim()),
      ...jobs.map((job) => String(job.department || "").trim()),
      ...jobs.map((job) => String(job.location || "").trim())
    ].filter(Boolean)
    return Array.from(new Set(tokens))
  }, [jobs])

  const parseSkills = (value) => (
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  )

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

  const allSkillSuggestions = useMemo(() => {
    const collected = [
      ...jobs.map((job) => job.requiredSkills),
      ...templates.map((template) => template.requiredSkills)
    ]
      .flatMap((text) => parseSkills(text))
      .filter(Boolean)
    return Array.from(new Set(collected)).sort((a, b) => a.localeCompare(b))
  }, [jobs, templates])

  const templateSkills = useMemo(() => {
    const key = newJobTitle.trim().toLowerCase()
    if (!key) return []
    const matched = templateByTitle.get(key)
    return parseSkills(matched?.requiredSkills || "")
  }, [newJobTitle, templateByTitle])

  const degreeMap = useMemo(() => ({
    "Frontend Developer": { bachelor: "Bachelor's Degree in Computer Science", master: "Master's Degree in Computer Science" },
    "Backend Developer": { bachelor: "Bachelor's Degree in Computer Science", master: "Master's Degree in Computer Science" },
    "Accounting Staff": { bachelor: "BS Accountancy", master: "Master's Degree in Accountancy" },
    "Administrative Staff": { bachelor: "Bachelor's Degree in Business Administration", master: "Master's Degree in Business Administration" },
    "English Instructor": { bachelor: "BSEd major in English", master: "Master's Degree in English Education" },
    "Math Instructor": { bachelor: "BSEd major in Mathematics", master: "Master's Degree in Mathematics Education" },
    "Social Studies Instructor": { bachelor: "BSEd major in Social Studies", master: "Master's Degree in Social Studies Education" },
    "Values Education Instructor": { bachelor: "BSEd major in Values Education", master: "Master's Degree in Values Education" },
    "Professional Education Instructor": { bachelor: "Education Graduate", master: "Master's Degree in Education" },
    "Special Needs Education Instructor": { bachelor: "BSEd major in Special Needs Education", master: "Master's Degree in Special Needs Education" },
    "Technology and Livelihood Education Instructor": { bachelor: "BSEd major in TLE", master: "Master's Degree in TLE" },
    "Tourism Management Instructor": { bachelor: "BS Tourism Management", master: "Master's Degree in Tourism Management" },
    "Hospitality Management Instructor": { bachelor: "BS Hospitality Management", master: "Master's Degree in Hospitality Management" },
    "Entrepreneurship Instructor": { bachelor: "BS Entrepreneurship", master: "Master's Degree in Entrepreneurship" },
    "Biotechnology Instructor": { bachelor: "BS Biology", master: "Master's Degree in Biology" },
    "Social Work Instructor": { bachelor: "BS Social Work", master: "Master's Degree in Social Work" },
    "English Language Instructor": { bachelor: "BA English Language", master: "Master's Degree in English Language" },
    "Faculty Member - Environmental Biology": { bachelor: "BS Biology", master: "Master's Degree in Biology" },
    "Faculty Member - Medical Biology": { bachelor: "BS Biology", master: "Master's Degree in Medical Biology" },
    "Faculty Member - Chemistry": { bachelor: "BS Chemistry", master: "Master's Degree in Chemistry" },
    "Instructor": { bachelor: "Bachelor's Degree in Education", master: "Master's Degree in Education" }
  }), [])

  const educationMapping = useMemo(() => {
    const title = String(newJobTitle || "").trim()
    if (!title) return null
    let mapping = degreeMap[title]
    if (!mapping && /instructor/i.test(title)) {
      mapping = degreeMap["Instructor"]
    }
    return mapping || null
  }, [newJobTitle, degreeMap])

  const educationOptions = useMemo(() => {
    if (!educationMapping) {
      return [
        { value: "Bachelor's Degree", label: "Bachelor's Degree" },
        { value: "Master's Degree", label: "Master's Degree" }
      ]
    }
    return [
      { value: educationMapping.bachelor, label: educationMapping.bachelor },
      { value: educationMapping.master, label: educationMapping.master }
    ]
  }, [educationMapping])

  useEffect(() => {
    if (!educationMapping) return
    const current = String(newMinimumEducation || "")
    const isGeneric = current === "Bachelor's Degree" || current === "Master's Degree" || !current
    if (isGeneric) {
      setNewMinimumEducation(educationMapping.bachelor)
    }
  }, [educationMapping, newMinimumEducation])

  const filteredSkillSuggestions = useMemo(() => {
    const existing = new Set(parseSkills(newRequiredSkills).map((item) => item.toLowerCase()))
    const templatePool = templateSkillCatalog.length ? templateSkillCatalog : templateSkills
    const contextualPool = isEditingJob ? jobSkillCatalog : templatePool
    const pool = Array.from(new Set([...contextualPool, ...allSkillSuggestions]))
      .filter((skill) => !existing.has(String(skill).toLowerCase()))
    if (!pool.length) return []
    const query = String(skillDraft || "").trim().toLowerCase()
    if (!query) return pool
    return pool
      .filter((skill) => skill.toLowerCase().includes(query))
      .slice(0)
  }, [newRequiredSkills, isEditingJob, jobSkillCatalog, templateSkills, templateSkillCatalog, allSkillSuggestions, skillDraft])

  const selectedRequiredSkills = useMemo(() => parseSkills(newRequiredSkills), [newRequiredSkills])

  const addRequiredSkill = (rawSkill) => {
    const skill = String(rawSkill || "").trim()
    if (!skill) return
    const current = parseSkills(newRequiredSkills)
    const exists = current.some((item) => item.toLowerCase() === skill.toLowerCase())
    if (exists) {
      setSkillDraft("")
      return
    }
    setNewRequiredSkills([...current, skill].join(", "))
    setSkillDraft("")
    setIsSkillsOpen(false)
  }

  const removeRequiredSkill = (skillToRemove) => {
    const next = parseSkills(newRequiredSkills).filter((item) => item !== skillToRemove)
    setNewRequiredSkills(next.join(", "))
  }

  const filteredSearchSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return searchSuggestions.slice(0, 8)
    return searchSuggestions
      .filter((token) => token.toLowerCase().includes(query))
      .slice(0, 8)
  }, [searchSuggestions, searchTerm])


  const applyTemplate = (templateId) => {
    const selected = templates.find((item) => String(item.id) === String(templateId))
    if (!selected) return
    setNewJobDescription(selected.description || "")
    setNewJobDepartment(selected.department || "")
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
    setNewJobDepartment(record.department || "")
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
    setNewJobDepartment("")
    setExpandedDepartments({})
    setNewJobType("Full-time")
    setNewJobStatus("active")
    setNewRequiredSkills("")
    setNewMinimumEducation("")
    setNewMinimumExperienceYears("0")
    setNewSalaryMin("")
    setNewSalaryMax("")
    setSkillDraft("")
    setIsSkillsOpen(false)
  }

  const openEditJobModal = (job) => {
    if (!job?.id) return
    setEditingJobId(job.id)
    setNewJobTitle(job.title || "")
    setNewJobDescription(job.description || "")
    setNewJobDepartment(job.department || "")
    setExpandedDepartments({})
    setNewJobType(job.type || "Full-time")
    setNewJobStatus(job.status || "active")
    setNewRequiredSkills(job.requiredSkills || "")
    setNewMinimumEducation(job.minimumEducation || "")
    setNewMinimumExperienceYears(String(job.minimumExperienceYears ?? 0))
    setNewSalaryMin(job.salaryMin != null ? String(job.salaryMin) : "")
    setNewSalaryMax(job.salaryMax != null ? String(job.salaryMax) : "")
    setSkillDraft("")
    setIsSkillsOpen(false)
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setEditingJobId(null)
    setSkillDraft("")
    setIsSkillsOpen(false)
  }

  const salaryLabel = useMemo(() => {
    const type = String(newJobType || "").toLowerCase()
    if (type.includes("part")) {
      return { min: "Salary Grade", max: "Hourly Rate" }
    }
    return { min: "Salary Grade", max: "Salary per Month" }
  }, [newJobType])

  useEffect(() => {
    const isPartTime = String(newJobType || "").toLowerCase().includes("part")
    const salaryValue = Number(newSalaryMax)
    if (!Number.isFinite(salaryValue) || salaryValue <= 0) return

    if (isPartTime) {
      if (lastMonthlySalaryRef.current == null) {
        lastMonthlySalaryRef.current = salaryValue
      }
      const hourly = Math.round((salaryValue / 160) * 100) / 100
      setNewSalaryMax(String(hourly))
      return
    }

    if (lastMonthlySalaryRef.current != null) {
      setNewSalaryMax(String(lastMonthlySalaryRef.current))
      lastMonthlySalaryRef.current = null
    }
  }, [newJobType])

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
    const parsedSalaryMin = Number(newSalaryMin)
    const parsedSalaryMax = Number(newSalaryMax)

    if (Number.isNaN(minExp) || minExp < 0) {
      showCreateJobNotice("fail", "Minimum experience must be a valid non-negative number.")
      return
    }

    if (Number.isNaN(parsedSalaryMin) || Number.isNaN(parsedSalaryMax) || parsedSalaryMin < 0 || parsedSalaryMax < 0) {
      showCreateJobNotice("fail", "Salary grade and salary amount must be valid non-negative numbers.")
      return
    }
    const { salaryMin, salaryMax } = normalizeSalaryRange(parsedSalaryMin, parsedSalaryMax)

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
    const parsedSalaryMin = Number(newSalaryMin)
    const parsedSalaryMax = Number(newSalaryMax)

    if (Number.isNaN(minExp) || minExp < 0) {
      showCreateJobNotice("fail", "Minimum experience must be a valid non-negative number.")
      return
    }

    if (Number.isNaN(parsedSalaryMin) || Number.isNaN(parsedSalaryMax) || parsedSalaryMin < 0 || parsedSalaryMax < 0) {
      showCreateJobNotice("fail", "Salary grade and salary amount must be valid non-negative numbers.")
      return
    }
    const { salaryMin, salaryMax } = normalizeSalaryRange(parsedSalaryMin, parsedSalaryMax)

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
                {isJobSeeker && (
                  (() => {
                    const key = String(job.title || "").trim().toLowerCase()
                    const match = key ? jobMatches[key] : null
                    if (!jobSeekerResume) {
                      return <span className="job-chip chip-warning">Upload resume to see match</span>
                    }
                    if (jobMatchStatus === "loading") {
                      return <span className="job-chip chip-muted">Checking match...</span>
                    }
                    if (jobMatchStatus === "error") {
                      return <span className="job-chip chip-warning">Match unavailable</span>
                    }
                    if (!match || match.score == null) {
                      return <span className="job-chip chip-warning">Match unavailable</span>
                    }
                    return (
                      <span className={`job-chip ${match.qualifies ? "chip-good" : "chip-bad"}`}>
                        {match.qualifies ? "Match" : "Not match"}
                      </span>
                    )
                  })()
                )}
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
            {createJobStatus && (
              <div className={`create-job-notice create-job-notice-${createJobStatus === "success" ? "success" : "fail"}`}>
                {createJobNotice || (createJobStatus === "success" ? "Success" : "Fail")}
              </div>
            )}

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
                      <label>Job Position</label>
                      <div
                        className="autocomplete"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="job-position-input">
                          <input
                            className="input"
                            type="text"
                            value={newJobTitle}
                            onChange={(e) => {
                              setNewJobTitle(e.target.value)
                              setIsJobPositionOpen(true)
                            }}
                            onFocus={() => setIsJobPositionOpen(true)}
                            placeholder="Select or type job position"
                          />
                          <span className="dropdown-caret">▾</span>
                        </div>
                        {isJobPositionOpen && (
                          <div className="autocomplete-menu">
                            {filteredJobCategoryGroups.map((group) => {
                              const autoExpand = Boolean(newJobTitle.trim())
                              const isExpanded = autoExpand || Boolean(expandedDepartments[group.department])
                              return (
                                <div key={`job-group-${group.department}`} className="autocomplete-group">
                                  <button
                                    type="button"
                                    className="autocomplete-group-label"
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      setExpandedDepartments((prev) => ({
                                        ...prev,
                                        [group.department]: !isExpanded
                                      }))
                                    }}
                                  >
                                    {group.department}
                                  </button>
                                {isExpanded && group.titles.map((title) => (
                                  <button
                                    key={`job-title-${group.department}-${title}`}
                                    type="button"
                                    className="autocomplete-item"
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      setNewJobTitle(title)
                                      setNewJobDepartment(group.department || "")
                                      setIsJobPositionOpen(false)
                                    }}
                                  >
                                    {title}
                                  </button>
                                ))}
                              </div>
                            )
                          })}
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
                        disabled
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
                        className="input create-job-readonly"
                        type="text"
                        value={defaultJobLocation || "Leyte Normal University"}
                        readOnly
                        aria-readonly="true"
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
                    <div
                      className="autocomplete create-skills-picker"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="create-skills-input-row">
                        <input
                          className="input create-skills-input"
                          type="text"
                          value={skillDraft}
                          onChange={(e) => {
                            setSkillDraft(e.target.value)
                          }}
                          onFocus={() => setIsSkillsOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addRequiredSkill(skillDraft)
                            }
                          }}
                          placeholder="Type a skill and click Add"
                        />
                        <button
                          type="button"
                          className="btn create-skill-add-btn"
                          onClick={() => setIsSkillsOpen((prev) => !prev)}
                        >
                          Add
                        </button>
                      </div>

                      {isSkillsOpen && (
                        <div className="autocomplete-menu create-skills-menu">
                          {skillDraft.trim() && (
                            <button
                              type="button"
                              className="autocomplete-item create-skill-custom"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                addRequiredSkill(skillDraft)
                              }}
                            >
                              Add "{skillDraft.trim()}"
                            </button>
                          )}

                          {filteredSkillSuggestions.length > 0 ? (
                            filteredSkillSuggestions.map((skill) => (
                              <button
                                key={`skill-${skill}`}
                                type="button"
                                className="autocomplete-item"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  addRequiredSkill(skill)
                                }}
                              >
                                {skill}
                              </button>
                            ))
                          ) : (
                            <p className="create-skills-empty">No skills found.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedRequiredSkills.length > 0 && (
                      <div className="create-skills-selected">
                        {selectedRequiredSkills.map((skill) => (
                          <span key={`selected-skill-${skill}`} className="create-skill-tag">
                            {skill}
                            <button
                              type="button"
                              className="create-skill-remove"
                              onClick={() => removeRequiredSkill(skill)}
                              aria-label={`Remove ${skill}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Minimum Education</label>
                      <CustomDropdown
                        className="input-dropdown"
                        options={educationOptions}
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
                      <label>{salaryLabel.min}</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={newSalaryMin}
                        onChange={(e) => setNewSalaryMin(e.target.value)}
                        placeholder="e.g., 15"
                      />
                    </div>

                    <div className="field-group">
                      <label>{salaryLabel.max}</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={newSalaryMax}
                        onChange={(e) => setNewSalaryMax(e.target.value)}
                        placeholder={String(newJobType || "").toLowerCase().includes("part") ? "e.g., 150" : "e.g., 30000"}
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
