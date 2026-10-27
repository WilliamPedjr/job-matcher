export function jobDescriptionForPosition(value, templateDescription = "") {
  const position = String(value || "").replace(/\s+/g, " ").trim()
  if (!position) return ""
  const template = String(templateDescription || "").trim()
  if (template) {
    const description = template.replace(/\{\{\s*job[_ ]position\s*\}\}|\[\s*job[_ ]position\s*\]/gi, () => position)
    return description.toLowerCase().includes(position.toLowerCase()) ? description : `${position}\n\n${description}`
  }
  return `We are seeking a qualified ${position} to join Leyte Normal University.\n\nThe ${position} will perform the duties and responsibilities assigned to the position, support department operations, and follow university policies and standards.\n\nApplicants should meet the educational attainment, eligibility, experience, and skills listed in this posting.`
}
