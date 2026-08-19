import React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/JobPostingPage.css'
import CustomDropdown from '../components/CustomDropdown'
import { getArchiveActorHeaders } from '../utils/archiveActor'

function JobPostingPage({ uploads = [], isEmployer = false, isJobSeeker = false, currentUser = null, jobSeekerId, jobSeekerResume, onViewApplicant, onDeleteApplicant, onJobsChanged, onViewJob }) {
  const APPLICATION_MATCH_BONUS_PERCENT = 10
  const JOB_FORM_DRAFT_KEY = "lnu-hire-job-form-draft"
  const [jobs, setJobs] = useState([])
  const [templates, setTemplates] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [jobPositionTypeFilter, setJobPositionTypeFilter] = useState("all")
  const [matchFilter, setMatchFilter] = useState("all")
  const [selectedJobTitle, setSelectedJobTitle] = useState("")
  const [modalSortConfig, setModalSortConfig] = useState({ key: "date", direction: "desc" })
  const [actionsJobId, setActionsJobId] = useState(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingJobId, setEditingJobId] = useState(null)
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newJobDescription, setNewJobDescription] = useState("")
  const [newJobDepartment, setNewJobDepartment] = useState("")
  const [newJobPositionType, setNewJobPositionType] = useState("Teaching")
  const [newJobItemNo, setNewJobItemNo] = useState("")
  const [newJobLocation, setNewJobLocation] = useState("Leyte Normal University")
  const [isJobPositionOpen, setIsJobPositionOpen] = useState(false)
  const [expandedDepartments, setExpandedDepartments] = useState({})
  const defaultJobLocation = "Leyte Normal University"
  const [newJobType, setNewJobType] = useState("Full-time")
  const [newJobStatus, setNewJobStatus] = useState("active")
  const [newJobDeadline, setNewJobDeadline] = useState("")
  const [newJobEligibility, setNewJobEligibility] = useState("Open to all qualified applicants")
  const [newRequiredSkills, setNewRequiredSkills] = useState("")
  const [newMinimumEducation, setNewMinimumEducation] = useState("Bachelor's Degree")
  const [newMinimumExperienceYears, setNewMinimumExperienceYears] = useState("0")
  const [newSalaryMin, setNewSalaryMin] = useState("")
  const [newSalaryMax, setNewSalaryMax] = useState("")
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [createJobStatus, setCreateJobStatus] = useState("")
  const [createJobNotice, setCreateJobNotice] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSkillsOpen, setIsSkillsOpen] = useState(false)
  const [skillDraft, setSkillDraft] = useState("")
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState(null)
  const [hasSavedJobDraft, setHasSavedJobDraft] = useState(false)
  const [isUsingSavedJobDraft, setIsUsingSavedJobDraft] = useState(false)
  const [jobMatches, setJobMatches] = useState({})
  const [jobMatchStatus, setJobMatchStatus] = useState("idle")
  const [jobSkillCatalog, setJobSkillCatalog] = useState([])
  const [jobSkillStatus, setJobSkillStatus] = useState("idle")
  const [globalSkillCatalog, setGlobalSkillCatalog] = useState([])
  const [globalSkillStatus, setGlobalSkillStatus] = useState("idle")
  const [templateSkillCatalog, setTemplateSkillCatalog] = useState([])
  const [templateSkillStatus, setTemplateSkillStatus] = useState("idle")
  const [jobApplicantActionsMenu, setJobApplicantActionsMenu] = useState(null)
  const [deleteToast, setDeleteToast] = useState(null)
  const deleteToastTimerRef = useRef(null)
  const isEditingJob = editingJobId != null
  const descriptionRef = useRef(null)
  const jobPositionRef = useRef(null)
  const skillsPickerRef = useRef(null)
  const jobApplicantActionsMenuRef = useRef(null)
  const skipTemplateApplyRef = useRef(false)

  useEffect(() => {
    if (!createJobStatus) return
    const timer = setTimeout(() => {
      setCreateJobStatus("")
      setCreateJobNotice("")
    }, 2600)
    return () => clearTimeout(timer)
  }, [createJobStatus])

  useEffect(() => {
    return () => {
      if (deleteToastTimerRef.current) {
        window.clearTimeout(deleteToastTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    try {
      setHasSavedJobDraft(Boolean(window.localStorage.getItem(JOB_FORM_DRAFT_KEY)))
    } catch {
      setHasSavedJobDraft(false)
    }
  }, [])

  useEffect(() => {
    if (!descriptionRef.current) return
    descriptionRef.current.style.height = "auto"
    descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`
  }, [newJobDescription, isCreateModalOpen])

  const showCreateJobNotice = (status, notice) => {
    setCreateJobStatus(status)
    setCreateJobNotice(notice)
  }

  const showDeleteToast = (message, type = "success", duration = 2600) => {
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
    if (!jobApplicantActionsMenu) return
    const closeMenu = (event) => {
      if (jobApplicantActionsMenuRef.current?.contains(event.target)) return
      setJobApplicantActionsMenu(null)
    }
    document.addEventListener("mousedown", closeMenu)
    document.addEventListener("scroll", closeMenu, true)
    window.addEventListener("resize", closeMenu)
    return () => {
      document.removeEventListener("mousedown", closeMenu)
      document.removeEventListener("scroll", closeMenu, true)
      window.removeEventListener("resize", closeMenu)
    }
  }, [jobApplicantActionsMenu])

  useEffect(() => {
    if (!isJobPositionOpen) return
    const onDocClick = (event) => {
      if (!jobPositionRef.current) return
      if (!jobPositionRef.current.contains(event.target)) {
        setIsJobPositionOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [isJobPositionOpen])

  useEffect(() => {
    if (!isSkillsOpen) return
    const onDocClick = (event) => {
      if (!skillsPickerRef.current) return
      if (!skillsPickerRef.current.contains(event.target)) {
        setIsSkillsOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [isSkillsOpen])

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
        const titles = jobs
          .map((job) => String(job.title || "").trim())
          .filter(Boolean)

        const response = await fetch(
          `http://localhost:5000/job-seekers/${jobSeekerId}/resume/match/batch`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({ jobTitles: titles }),
          }
        )

        if (!response.ok) {
          throw new Error("Failed to check resume matches.")
        }

        const payload = await response.json()
        const results = Array.isArray(payload?.matches) ? payload.matches : []

        if (!isMounted) return
        const next = {}
        results.filter(Boolean).forEach((item) => {
          const key = String(item.key || "").trim().toLowerCase()
          if (!key) return
          const score = Number(item.score)
          const minimumScore = Number(item.minimumScore ?? 50)
          const normalizedMinimumScore = Number.isFinite(minimumScore) ? minimumScore : 50
          const scoreWithBonus = Number.isFinite(score)
            ? Math.min(100, score + APPLICATION_MATCH_BONUS_PERCENT)
            : null
          next[key] = {
            score: scoreWithBonus,
            qualifies: scoreWithBonus != null ? scoreWithBonus >= normalizedMinimumScore : false
          }
        })
        setJobMatches(next)
        setJobMatchStatus("ready")
      } catch (error) {
        if (error?.name === "AbortError") return
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

      const jobPositionType = String(job.jobPosition || job.job_position || "").toLowerCase()
      const matchesJobPositionType = jobPositionTypeFilter === "all"
        ? true
        : jobPositionType === jobPositionTypeFilter
      if (!matchesJobPositionType) return false

      if (isJobSeeker && matchFilter !== "all") {
        const key = String(job.title || "").trim().toLowerCase()
        const match = key ? jobMatches[key] : null
        if (!match || match.score == null) return false
        if (matchFilter === "match" && !match.qualifies) return false
        if (matchFilter === "not-match" && match.qualifies) return false
      }

      if (!query) return true
      const haystack = `${job.title || ""} ${job.description || ""} ${job.department || ""} ${job.jobPosition || job.job_position || ""} ${job.itemNo || job.item_no || ""} ${job.location || ""} ${job.deadline || ""} ${job.eligibility || ""}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [jobs, searchTerm, statusFilter, jobPositionTypeFilter, isJobSeeker, matchFilter, jobMatches])

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
      ...jobs.map((job) => String(job.jobPosition || job.job_position || "").trim()),
      ...jobs.map((job) => String(job.itemNo || job.item_no || "").trim()),
      ...jobs.map((job) => String(job.location || "").trim())
    ].filter(Boolean)
    return Array.from(new Set(tokens))
  }, [jobs])

  const parseSkills = (value) => {
    if (!value) return []
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean)
    }

    const normalized = String(value).trim()
    if (!normalized) return []

    if (normalized.startsWith("[") && normalized.endsWith("]")) {
      try {
        const parsed = JSON.parse(normalized)
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean)
        }
      } catch {
        // Fall back to delimiter parsing.
      }
    }

    return normalized
      .split(/[,;\n|]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const formatMatchScore = (score) => {
    const value = Number(score)
    return Number.isFinite(value) ? `${value.toFixed(2)}%` : "-"
  }

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
    setNewJobPositionType(selected.jobPosition || selected.job_position || "Teaching")
    setNewJobItemNo(selected.itemNo || selected.item_no || "")
    setNewJobLocation(selected.location || defaultJobLocation)
    setNewJobType(selected.type || "Full-time")
    setNewJobDeadline(selected.deadline || "")
    setNewJobEligibility(selected.eligibility || "Open to all qualified applicants")
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
    setNewJobPositionType(record.jobPosition || record.job_position || "Teaching")
    setNewJobItemNo(record.itemNo || record.item_no || "")
    setNewJobLocation(record.location || defaultJobLocation)
    setNewJobType(record.type || "Full-time")
    setNewJobDeadline(record.deadline || "")
    setNewJobEligibility(record.eligibility || "Open to all qualified applicants")
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
    if (skipTemplateApplyRef.current) {
      skipTemplateApplyRef.current = false
      return
    }
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

  const matchOptions = [
    { value: "all", label: "All" },
    { value: "match", label: "Match" },
    { value: "not-match", label: "Not match" }
  ]

  const jobPositionTypeFilterOptions = [
    { value: "all", label: "All Positions" },
    { value: "teaching", label: "Teaching" },
    { value: "non-teaching", label: "Non-Teaching" }
  ]

  const eligibilityOptions = [
    { value: "Open to all qualified applicants", label: "Open to all qualified applicants" },
    { value: "Internal applicants only", label: "Internal applicants only" },
    { value: "External applicants only", label: "External applicants only" },
    { value: "Licensed applicants only", label: "Licensed applicants only" }
  ]

  const jobStatusOptions = [
    { value: "active", label: "Active" },
    { value: "closed", label: "Closed" }
  ]

  const jobPositionTypeOptions = [
    { value: "Teaching", label: "Teaching" },
    { value: "Non-Teaching", label: "Non-Teaching" }
  ]

  const updateJobStatus = async (jobId, status) => {
    try {
      const response = await fetch(`http://localhost:5000/jobs/${jobId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getArchiveActorHeaders(currentUser)
        },
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

  const duplicateJobPost = async (job) => {
    if (!job) return
    setActionsJobId(null)
    const baseTitle = String(job.title || "Job Post").replace(/\s+Copy(?:\s+\d+)?$/i, "").trim() || "Job Post"
    const existingTitles = new Set(jobs.map((item) => String(item.title || "").trim().toLowerCase()))
    let duplicateTitle = `${baseTitle} Copy`
    let copyNumber = 2
    while (existingTitles.has(duplicateTitle.toLowerCase())) {
      duplicateTitle = `${baseTitle} Copy ${copyNumber}`
      copyNumber += 1
    }

    try {
      const response = await fetch("http://localhost:5000/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getArchiveActorHeaders(currentUser)
        },
        body: JSON.stringify({
          title: duplicateTitle,
          description: job.description || "",
          department: job.department || "",
          jobPosition: job.jobPosition || job.job_position || "Teaching",
          itemNo: "",
          location: job.location || defaultJobLocation,
          type: job.type || "Full-time",
          status: "closed",
          deadline: job.deadline || null,
          eligibility: job.eligibility || "Open to all qualified applicants",
          requiredSkills: job.requiredSkills || job.required_skills || "",
          minimumEducation: job.minimumEducation || job.minimum_education || "",
          minimumExperienceYears: job.minimumExperienceYears ?? job.minimum_experience_years ?? 0,
          salaryMin: job.salaryMin ?? job.salary_min ?? null,
          salaryMax: job.salaryMax ?? job.salary_max ?? null,
          activityEvent: "job.duplicated",
          sourceJobId: job.id,
          sourceJobTitle: job.title || ""
        })
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to duplicate job post.")
      }
      await fetchJobs({ silent: true })
      await onJobsChanged?.()
      showCreateJobNotice("success", "Job post duplicated with empty item number.")
    } catch (err) {
      showCreateJobNotice("fail", err.message || "Failed to duplicate job post.")
    }
  }

  const performDeleteJobPost = async (jobId) => {
    try {
      const response = await fetch(`http://localhost:5000/jobs/${jobId}`, {
        method: "DELETE",
        headers: getArchiveActorHeaders(currentUser)
      })
      if (!response.ok) {
        throw new Error("Failed to delete job post.")
      }
      setActionsJobId(null)
      await fetchJobs({ silent: true })
      await onJobsChanged?.()
      showDeleteToast("Job post deleted.", "success")
    } catch (err) {
      setError(err.message || "Failed to delete job post.")
      showDeleteToast(err.message || "Failed to delete job post.", "fail")
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

  const openJobApplicantActionsMenu = (event, item) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setJobApplicantActionsMenu({
      item,
      top: rect.bottom + 6,
      left: Math.max(12, rect.right - 150)
    })
  }

  const handleApplyJob = (job) => {
    if (!job) return
    onViewJob?.(job)
  }

  const resetJobForm = () => {
    setNewJobTitle("")
    setNewJobDescription("")
    setNewJobDepartment("")
    setNewJobPositionType("Teaching")
    setNewJobItemNo("")
    setNewJobLocation(defaultJobLocation)
    setExpandedDepartments({})
    setNewJobType("Full-time")
    setNewJobStatus("active")
    setNewJobDeadline("")
    setNewJobEligibility("Open to all qualified applicants")
    setNewRequiredSkills("")
    setNewMinimumEducation("")
    setNewMinimumExperienceYears("0")
    setNewSalaryMin("")
    setNewSalaryMax("")
    setSkillDraft("")
    setIsSkillsOpen(false)
  }

  const getJobFormDraftPayload = () => ({
    title: newJobTitle,
    description: newJobDescription,
    department: newJobDepartment,
    jobPosition: newJobPositionType,
    itemNo: newJobItemNo,
    location: newJobLocation,
    type: newJobType,
    status: newJobStatus,
    deadline: newJobDeadline,
    eligibility: newJobEligibility,
    requiredSkills: newRequiredSkills,
    minimumEducation: newMinimumEducation,
    minimumExperienceYears: newMinimumExperienceYears,
    salaryMin: newSalaryMin,
    salaryMax: newSalaryMax,
    savedAt: new Date().toISOString()
  })

  const jobFormHasDraftData = (draft = getJobFormDraftPayload()) => {
    return [
      draft.title,
      draft.description,
      draft.department,
      draft.jobPosition,
      draft.itemNo,
      draft.deadline,
      draft.requiredSkills,
      draft.minimumEducation,
      draft.minimumExperienceYears !== "0" ? draft.minimumExperienceYears : "",
      draft.salaryMin,
      draft.salaryMax
    ].some((value) => String(value ?? "").trim())
  }

  const saveJobFormDraft = () => {
    if (isEditingJob) return
    const draft = getJobFormDraftPayload()
    try {
      if (jobFormHasDraftData(draft)) {
        window.localStorage.setItem(JOB_FORM_DRAFT_KEY, JSON.stringify(draft))
        setHasSavedJobDraft(true)
        return
      }
      window.localStorage.removeItem(JOB_FORM_DRAFT_KEY)
      setHasSavedJobDraft(false)
      setIsUsingSavedJobDraft(false)
    } catch {
      // Local storage can be unavailable in private browser modes.
    }
  }

  const clearSavedJobDraft = () => {
    try {
      window.localStorage.removeItem(JOB_FORM_DRAFT_KEY)
    } catch {
      // Local storage can be unavailable in private browser modes.
    }
    setHasSavedJobDraft(false)
    setIsUsingSavedJobDraft(false)
  }

  const applyJobFormDraft = (draft) => {
    skipTemplateApplyRef.current = Boolean(String(draft?.title || "").trim())
    setNewJobTitle(draft?.title || "")
    setNewJobDescription(draft?.description || "")
    setNewJobDepartment(draft?.department || "")
    setNewJobPositionType(draft?.jobPosition || "Teaching")
    setNewJobItemNo(draft?.itemNo || "")
    setNewJobLocation(draft?.location || defaultJobLocation)
    setExpandedDepartments({})
    setNewJobType(draft?.type || "Full-time")
    setNewJobStatus(draft?.status === "closed" ? "closed" : "active")
    setNewJobDeadline(draft?.deadline || "")
    setNewJobEligibility(draft?.eligibility || "Open to all qualified applicants")
    setNewRequiredSkills(draft?.requiredSkills || "")
    setNewMinimumEducation(draft?.minimumEducation || "")
    setNewMinimumExperienceYears(String(draft?.minimumExperienceYears ?? 0))
    setNewSalaryMin(draft?.salaryMin != null ? String(draft.salaryMin) : "")
    setNewSalaryMax(draft?.salaryMax != null ? String(draft.salaryMax) : "")
    setSkillDraft("")
    setIsSkillsOpen(false)
  }

  const loadSavedJobDraft = () => {
    try {
      const rawDraft = window.localStorage.getItem(JOB_FORM_DRAFT_KEY)
      if (!rawDraft) return false
      applyJobFormDraft(JSON.parse(rawDraft))
      setHasSavedJobDraft(true)
      setIsUsingSavedJobDraft(true)
      return true
    } catch {
      clearSavedJobDraft()
      return false
    }
  }

  const startNewJobForm = () => {
    clearSavedJobDraft()
    resetJobForm()
    setEditingJobId(null)
    setIsCreateModalOpen(true)
  }

  const openCreateJobModal = () => {
    if (isJobSeeker) return
    setEditingJobId(null)
    const didLoadDraft = loadSavedJobDraft()
    if (!didLoadDraft) {
      resetJobForm()
    }
    setIsCreateModalOpen(true)
  }

  const openEditJobModal = (job) => {
    if (!job?.id) return
    setIsUsingSavedJobDraft(false)
    setEditingJobId(job.id)
    setNewJobTitle(job.title || "")
    setNewJobDescription(job.description || "")
    setNewJobDepartment(job.department || "")
    setNewJobPositionType(job.jobPosition || job.job_position || "Teaching")
    setNewJobItemNo(job.itemNo || job.item_no || "")
    setNewJobLocation(job.location || defaultJobLocation)
    setExpandedDepartments({})
    setNewJobType(job.type || "Full-time")
    setNewJobStatus(job.status || "active")
    setNewJobDeadline(job.deadline || "")
    setNewJobEligibility(job.eligibility || "Open to all qualified applicants")
    setNewRequiredSkills(job.requiredSkills || "")
    setNewMinimumEducation(job.minimumEducation || "")
    setNewMinimumExperienceYears(String(job.minimumExperienceYears ?? 0))
    setNewSalaryMin(job.salaryMin != null ? String(job.salaryMin) : "")
    setNewSalaryMax(job.salaryMax != null ? String(job.salaryMax) : "")
    setSkillDraft("")
    setIsSkillsOpen(false)
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = ({ saveDraft = true } = {}) => {
    if (saveDraft) {
      saveJobFormDraft()
    }
    setIsCreateModalOpen(false)
    setEditingJobId(null)
    setIsUsingSavedJobDraft(false)
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

  const createJobPost = async () => {
    const hasMissingField = (
      !newJobTitle.trim() ||
      !newJobDescription.trim() ||
      !newJobDepartment.trim() ||
      !newJobPositionType.trim() ||
      !newJobItemNo.trim() ||
      !newJobLocation.trim() ||
      !newJobType.trim() ||
      !newJobStatus.trim() ||
      !newJobDeadline.trim() ||
      !newJobEligibility.trim() ||
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

    const minExp = newMinimumExperienceYears === "" ? 0 : Number(newMinimumExperienceYears)
    const parsedSalaryMin = Number(newSalaryMin)
    const parsedSalaryMax = Number(newSalaryMax)

    if (Number.isNaN(minExp) || minExp < 0) {
      showCreateJobNotice("fail", "Minimum experience must be a valid non-negative number.")
      return
    }

    if (Number.isNaN(parsedSalaryMin) || parsedSalaryMin < 0 || Number.isNaN(parsedSalaryMax) || parsedSalaryMax < 0) {
      showCreateJobNotice("fail", "Salary grade and salary amount must be valid non-negative numbers.")
      return
    }
    const { salaryMin, salaryMax } = normalizeSalaryRange(parsedSalaryMin, parsedSalaryMax)

    setIsCreatingJob(true)
    setError("")
    try {
      const response = await fetch("http://localhost:5000/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getArchiveActorHeaders(currentUser)
        },
        body: JSON.stringify({
          title: newJobTitle.trim(),
          description: newJobDescription.trim(),
          department: newJobDepartment.trim(),
          jobPosition: newJobPositionType,
          itemNo: newJobItemNo.trim(),
          location: newJobLocation.trim(),
          type: newJobType.trim(),
          status: newJobStatus,
          deadline: newJobDeadline || null,
          eligibility: newJobEligibility,
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

      clearSavedJobDraft()
      closeCreateModal({ saveDraft: false })
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
      !newJobPositionType.trim() ||
      !newJobItemNo.trim() ||
      !newJobLocation.trim() ||
      !newJobType.trim() ||
      !newJobStatus.trim() ||
      !newJobDeadline.trim() ||
      !newJobEligibility.trim() ||
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

    const minExp = newMinimumExperienceYears === "" ? 0 : Number(newMinimumExperienceYears)
    const parsedSalaryMin = Number(newSalaryMin)
    const parsedSalaryMax = Number(newSalaryMax)

    if (Number.isNaN(minExp) || minExp < 0) {
      showCreateJobNotice("fail", "Minimum experience must be a valid non-negative number.")
      return
    }

    if (Number.isNaN(parsedSalaryMin) || parsedSalaryMin < 0 || Number.isNaN(parsedSalaryMax) || parsedSalaryMax < 0) {
      showCreateJobNotice("fail", "Salary grade and salary amount must be valid non-negative numbers.")
      return
    }
    const { salaryMin, salaryMax } = normalizeSalaryRange(parsedSalaryMin, parsedSalaryMax)

    setIsCreatingJob(true)
    setError("")
    try {
      const response = await fetch(`http://localhost:5000/jobs/${editingJobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getArchiveActorHeaders(currentUser)
        },
        body: JSON.stringify({
          title: newJobTitle.trim(),
          description: newJobDescription.trim(),
          department: newJobDepartment.trim(),
          jobPosition: newJobPositionType,
          itemNo: newJobItemNo.trim(),
          location: newJobLocation.trim(),
          type: newJobType.trim(),
          status: newJobStatus,
          deadline: newJobDeadline || null,
          eligibility: newJobEligibility,
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

      closeCreateModal({ saveDraft: false })
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
            onClick={openCreateJobModal}
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
        <CustomDropdown
          className="jobs-filter"
          options={jobPositionTypeFilterOptions}
          value={jobPositionTypeFilter}
          onChange={setJobPositionTypeFilter}
          placeholder="All Positions"
        />
        {isJobSeeker && (
          <CustomDropdown
            className="jobs-filter"
            options={matchOptions}
            value={matchFilter}
            onChange={setMatchFilter}
            placeholder="All Match"
          />
        )}
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
            <article
              key={job.id ?? `template-${job.title}`}
              className="job-card job-card-modern job-card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isJobSeeker) {
                  onViewJob?.(job)
                  return
                }
                openEditJobModal(job)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  if (isJobSeeker) {
                    onViewJob?.(job)
                    return
                  }
                  openEditJobModal(job)
                }
              }}
            >
              <div className="job-card-head">
                <div>
                  <h2 className={`job-title-text ${isJobSeeker ? "" : "job-title-admin"}`.trim()}>
                    {job.title}
                  </h2>
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
                                onClick={() => duplicateJobPost(job)}
                              >
                                Duplicate Post
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
                {job.itemNo || job.item_no ? <span className="job-chip">Item {job.itemNo || job.item_no}</span> : null}
                {job.jobPosition || job.job_position ? <span className="job-chip chip-outline">{job.jobPosition || job.job_position}</span> : null}
                <span className="job-chip">{job.location || "-"}</span>
                <span className="job-chip chip-outline">{job.type || "-"}</span>
                {job.deadline ? <span className="job-chip chip-outline">Deadline {new Date(job.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span> : null}
                {job.eligibility ? <span className="job-chip chip-outline">{job.eligibility}</span> : null}
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

              {isJobSeeker && parseSkills(job.requiredSkills || job.required_skills || "").length > 0 && (
                <div className="job-card-skill-preview">
                  {/* <span className="job-card-skill-label">Needed skills</span> */}
                  <div className="job-card-chips job-card-skill-chips">
                    {parseSkills(job.requiredSkills || job.required_skills || "").slice(0, 5).map((skill) => (
                      <span key={`${job.id ?? job.title}-${skill}`} className="job-chip chip-outline">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {isJobSeeker && (
                <div className="job-card-footer">
                  {/* <button
                    type="button"
                    className="btn job-apply-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleApplyJob(job)
                    }}
                  >
                    Apply
                  </button> */}
                </div>
              )}

              {!isJobSeeker && (
                <button
                  className="job-applicants job-applicants-bottom"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
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
                <div className="table-wrap job-applicants-table-wrap">
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
                      {sortedSelectedJobApplicants.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>
                            <div className="applicant-cell">
                              <strong>{item.name || "(No name)"}</strong>
                              <span>{item.idNumber || item.id_number || item.jobSeekerIdNumber || item.job_seeker_id_number || item.email || "No ID number"}</span>
                            </div>
                          </td>
                          <td>{item.phone || "No phone"}</td>
                          <td>{item.applied_job_title || item.matched_job_title || selectedJobTitle || "-"}</td>
                          <td>{item.match_score != null ? `${Number(item.match_score).toFixed(2)}%` : "-"}</td>
                          <td>
                            <span className={`table-classification ${(item.classification || "Not Qualified").toLowerCase().replace(/\s+/g, "-")}`}>
                              {item.classification || "Not Qualified"}
                            </span>
                          </td>
                          <td>{item.original_name || "-"}</td>
                          <td>{item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "-"}</td>
                          <td className="actions-cell actions-col">
                            <button
                              type="button"
                              className="action-btn action-trigger job-applicant-ellipsis"
                              aria-label="Open applicant actions"
                              onClick={(e) => {
                                e.stopPropagation()
                                openJobApplicantActionsMenu(e, item)
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
              </div>
            )}
          </div>
        </div>
      )}

      {jobApplicantActionsMenu && (
        <div
          ref={jobApplicantActionsMenuRef}
          className="actions-menu actions-menu-floating"
          style={{ top: `${jobApplicantActionsMenu.top}px`, left: `${jobApplicantActionsMenu.left}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="actions-menu-item"
            onClick={() => {
              const target = jobApplicantActionsMenu
              setJobApplicantActionsMenu(null)
              if (target?.item) {
                setSelectedJobTitle("")
                onViewApplicant?.(target.item)
              }
            }}
          >
            View
          </button>
          <a
            className="actions-menu-item"
            href={jobApplicantActionsMenu?.item?.id ? `http://localhost:8000/api/uploads/${jobApplicantActionsMenu.item.id}/download` : "#"}
            onClick={() => setJobApplicantActionsMenu(null)}
          >
            Download
          </a>
          <button
            type="button"
            className="actions-menu-item danger"
            onClick={() => {
              const target = jobApplicantActionsMenu
              setJobApplicantActionsMenu(null)
              if (target?.item?.id != null) {
                handleDeleteApplicantInJobModal(target.item.id)
              }
            }}
          >
            Delete
          </button>
        </div>
      )}

      {confirmDeleteJobId != null && (
        <div
          className="modal-overlay delete-confirm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmDeleteJobId(null)
            }
          }}
        >
          <div className="modal-card delete-confirm-card">
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
                <p className="create-job-subtitle">
                  {isUsingSavedJobDraft ? "Continuing your saved draft" : "Basic information about the position"}
                </p>
              </div>
              <div className="create-job-header-actions">
                {!isEditingJob && hasSavedJobDraft && (
                  <button
                    type="button"
                    className="create-job-new-btn"
                    onClick={startNewJobForm}
                  >
                    New Job
                  </button>
                )}
                <button type="button" className="close-x" onClick={closeCreateModal}>×</button>
              </div>
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
                        ref={jobPositionRef}
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
                            placeholder="Select or type job title"
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
                        onChange={(e) => setNewJobDepartment(e.target.value)}
                      />
                    </div>

                    <div className="field-group">
                      <label>Job Position Type</label>
                      <CustomDropdown
                        className="input-dropdown"
                        options={jobPositionTypeOptions}
                        value={newJobPositionType}
                        onChange={setNewJobPositionType}
                        placeholder="Teaching"
                      />
                    </div>
                  </div>

                  <div className="modal-grid">
                    <div className="field-group">
                      <label>Plantilla Item No.</label>
                      <input
                        className="input"
                        type="text"
                        value={newJobItemNo}
                        onChange={(e) => setNewJobItemNo(e.target.value)}
                      />
                    </div>

                    <div className="field-group">
                      <label>Location</label>
                      <input
                        className="input create-job-readonly"
                        type="text"
                        value={newJobLocation}
                        readOnly
                        aria-readonly="true"
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
                      <label>Deadline</label>
                      <input
                        className="input"
                        type="date"
                        value={newJobDeadline}
                        onChange={(e) => setNewJobDeadline(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="modal-grid">
                    <div className="field-group create-job-status-wrap">
                      <label>Status</label>
                      <CustomDropdown
                        className="input-dropdown create-job-status"
                        options={jobStatusOptions}
                        value={newJobStatus}
                        onChange={setNewJobStatus}
                        placeholder="Active"
                      />
                    </div>

                    <div className="field-group">
                      <label>Eligibility</label>
                      <CustomDropdown
                        className="input-dropdown"
                        options={eligibilityOptions}
                        value={newJobEligibility}
                        onChange={setNewJobEligibility}
                        placeholder="Select eligibility"
                      />
                    </div>
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
                      ref={skillsPickerRef}
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

      {deleteToast && (
        <div className={`toast ${deleteToast.type === "success" ? "toast-success" : "toast-fail"}`}>
          {deleteToast.message}
        </div>
      )}
    </section>
  )
}

export default JobPostingPage
