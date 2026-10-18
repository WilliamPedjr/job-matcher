export function normalizeSkills(value = []) {
  const skills = Array.isArray(value) ? value : String(value || "").split(/[,;\n]+/)
  const seen = new Set()
  return skills.map((skill) => String(skill).replace(/\s+/g, " ").trim()).filter((skill) => {
    const key = skill.toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function combinedSkills(experiences = []) {
  return normalizeSkills(experiences.flatMap((item) => normalizeSkills(item.skills)))
}

export function validateLearnedSkills(value) {
  const skills = normalizeSkills(value)
  if (skills.length > 100) return "Enter no more than 100 skills for this record."
  if (skills.some((skill) => [...skill].length > 100)) return "Each skill must be 100 characters or fewer."
  return ""
}
