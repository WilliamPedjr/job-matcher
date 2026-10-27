import { normalizeSkills } from "./profileSkills.js"

const text = (value) => String(value ?? "").trim()
const value = (record, camel, snake) => text(record?.[camel] ?? record?.[snake])
const filename = (name) => text(name).normalize("NFC").replace(/\s+/g, " ").toLowerCase()
const details = (description) => Object.fromEntries(text(description).split(/\r?\n/).map((line) => {
  const colon = line.indexOf(":")
  return [line.slice(0, colon).trim().toLowerCase(), colon < 0 ? "" : line.slice(colon + 1).trim()]
}))

export function missingProfileFields(profile = {}, resume = null, supporting = []) {
  profile ||= {}
  const missing = []
  const require = (condition, label) => { if (!condition) missing.push(label) }
  require(value(profile, "fullName", "full_name"), "Full name")
  require(text(profile.username), "Username")
  require(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(profile.email)), "Valid email address")
  require(/^(?:\+?63|0)?9\d{9}$/.test(text(profile.phone).replace(/[\s()-]/g, "")), "Valid phone number")
  require(text(profile.address), "Address")
  require(text(profile.profilePhotoUrl), "Profile picture")

  const experiences = profile.experience ?? profile.experiences ?? []
  const educations = profile.education ?? profile.educations ?? []
  require(normalizeSkills([...(profile.skills || []), ...(profile.manual_skills || []), ...experiences.flatMap((item) => item.skills || [])]).length, "Skills")
  require(resume && resume.available !== false, "Personal Data Sheet (PDS)")
  const files = (supporting || []).filter((file) => file.available !== false)
  const hasFile = (name) => text(name) && files.some((file) => filename(file.originalName ?? file.original_name) === filename(name))
  const type = (file) => text(file.type ?? file.doc_type).toLowerCase()
  for (const [key, label] of [["certificate", "Certificate"], ["portfolio", "Portfolio"], ["recommendation", "Application letter"], ["transcript", "Transcript"], ["others", "Other supporting document"]]) {
    require(files.some((file) => type(file) === key), label)
  }
  require(files.some((file) => /^eligibility:.+/.test(type(file))), "Board / Civil Eligibility certificate")
  require(educations.length && educations.every((item) => {
    const info = details(item.description)
    return value(item, "schoolName", "school_name") && text(item.degree)
      && value(item, "startYear", "start_year") && value(item, "endYear", "end_year")
      && info["educational level"] && info["graduation status rank"] && info["year graduated"]
      && info["academic honors / awards received"]
  }), "Education (complete all required details)")
  const training = (item) => /record type:\s*training|number of hours credit:|type of ld classification:|certificate file:/i.test(item.description || "")
  for (const [isTraining, label] of [[false, "Job Experience (complete details and upload COE)"], [true, "Learning & Development (complete details and upload certificate)"]]) {
    const records = experiences.filter((item) => training(item) === isTraining)
    require(records.length && records.every((item) => {
      const info = details(item.description)
      const base = text(item.position) && value(item, "companyName", "company_name")
        && value(item, "startDate", "start_date") && value(item, "endDate", "end_date")
        && normalizeSkills(item.skills).length
      return base && (isTraining
        ? Number(info["number of hours credit"]) > 0 && info["type of ld classification"] && hasFile(info["certificate file"])
        : info["government service"]
          && info["status of appointment"] && hasFile(info["coe file"]))
    }), label)
  }
  return missing
}
