const noRequirementValues = new Set([
  "", "none", "none required", "not required", "no requirement", "no requirements",
  "no required skill", "no required skills", "n a", "na", "not applicable",
  "open qualification", "open qualifications", "open to all", "open to all applicants"
])

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
const lines = (value) => (Array.isArray(value) ? value : String(value || "").split(/\n+/))
  .map((line) => String(line).trim()).filter(Boolean)

export function buildJobRequirements(job = {}, analysis = null, status = "idle") {
  const education = job.minimumEducation ?? job.minimum_education ?? ""
  const eligibility = job.eligibility || ""
  const experienceYears = Number(job.minimumExperienceYears ?? job.minimum_experience_years ?? 0)
  const skills = job.requiredSkills || job.required_skills || job.required_skills_text || ""
  const requirementItems = (Array.isArray(skills) ? skills : String(skills).split(/[,;\n|]+/))
    .map((item) => String(item).trim()).filter((item) => !noRequirementValues.has(normalize(item)))
  const isTraining = requirementItems.length > 0 && requirementItems.every((item) =>
    /\b(?:training|trainings|seminar|workshop)\b|\b\d+\s*(?:hours?|hrs?)\b/i.test(item))
  const breakdown = analysis?.resume_summary?.score_breakdown || {}
  const definitions = [
    {
      key: "eligibility", label: "Eligibility", requirement: eligibility,
      optional: noRequirementValues.has(normalize(eligibility)) || normalize(eligibility).includes("open to all"),
      evidence: lines(analysis?.eligibility_lines ?? analysis?.eligibility_text ?? analysis?.resume_summary?.eligibility),
      score: analysis?.eligibility_match_score ?? breakdown.eligibility,
      action: "Add or update your Board / Civil Eligibility and upload the supporting certificate in Profile."
    },
    {
      key: "education", label: "Minimum education", requirement: education,
      optional: noRequirementValues.has(normalize(education)) || [
        "open to all education levels", "all education levels", "any education level",
        "must be able to read and write", "able to read and write", "read and write"
      ].includes(normalize(education)),
      evidence: lines(analysis?.education_text),
      score: analysis?.education_match_score ?? breakdown.education,
      action: "Add or update your education in Profile so your qualification can be checked against this requirement."
    },
    {
      key: "experience", label: "Minimum experience",
      requirement: `${experienceYears} ${experienceYears === 1 ? "year" : "years"}`,
      optional: !Number.isFinite(experienceYears) || experienceYears <= 0,
      evidence: lines(analysis?.experience_text),
      score: analysis?.experience_match_score ?? breakdown.experience,
      action: "Add or update your job experience and employment certificates in Profile."
    },
    {
      key: isTraining ? "training" : "skills", label: isTraining ? "Training" : "Required skills",
      requirement: Array.isArray(skills) ? skills.join(", ") : skills,
      optional: noRequirementValues.has(normalize(skills)),
      evidence: lines(isTraining ? analysis?.training_text : analysis?.matched_skills),
      missing: lines(isTraining ? analysis?.missing_training : analysis?.missing_skills),
      score: isTraining
        ? (analysis?.training_match_score ?? breakdown.training)
        : (analysis?.skills_match_score ?? breakdown.skills),
      action: isTraining
        ? "Add your completed training and certificates in Profile."
        : "Add skills learned to your Job Experience and L&D records in Profile."
    }
  ]

  return definitions.map((item) => {
    const hasScore = item.score !== null && item.score !== undefined && item.score !== "" && Number.isFinite(Number(item.score))
    const state = item.optional ? "optional"
      : status !== "ready" || !hasScore ? "unchecked"
        : Number(item.score) >= 100 ? "met"
          : item.evidence.length ? "incomplete" : "missing"
    return { ...item, state, statusLabel: {
      optional: "No requirement", unchecked: "Not checked", met: "Met",
      incomplete: "Needs attention", missing: "Missing information"
    }[state] }
  })
}
