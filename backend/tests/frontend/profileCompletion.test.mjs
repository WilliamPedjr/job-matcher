import test from "node:test"
import assert from "node:assert/strict"
import { missingProfileFields } from "../../resources/js/react/utils/profileCompletion.js"

function complete() {
  const profile = {
    fullName: "Test Applicant", username: "applicant", email: "applicant@example.com", phone: "+639171234567",
    address: "Tacloban City", profilePhotoUrl: "/api/job-seekers/1/photo?v=1", linkedInUrl: "https://linkedin.com/in/applicant",
    manual_skills: ["Management"],
    education: [{ schoolName: "University", degree: "Bachelor of Education", startYear: "2018", endYear: "2022",
      description: "Educational Level: College\nGraduation Status Rank: Graduated\nYear Graduated: 2022\nAcademic Honors / Awards Received: N/A" }],
    experience: [
      { position: "Teacher", companyName: "School", startDate: "2022-01-01", endDate: "2023-01-01", skills: ["Teaching"],
        description: "Record Type: Work Experience\nGovernment Service: No\nMonthly Gross Salary: 24,000\nStatus of Appointment: Temporary\nCOE File: Regaña-COE.pdf" },
      { position: "Workshop", companyName: "University", startDate: "2024-01-01", endDate: "2024-01-02", skills: ["Management"],
        description: "Record Type: Training\nNumber of Hours Credit: 8\nType of LD Classification: Managerial\nCertificate File: certificate.png" },
    ],
  }
  const files = [
    { type: "certificate", originalName: "certificate.png", available: true },
    { type: "portfolio", originalName: "portfolio.pdf", available: true },
    { type: "recommendation", originalName: "letter.pdf", available: true },
    { type: "transcript", originalName: "transcript.pdf", available: true },
    { type: "others", originalName: "Regaña-COE.pdf", available: true },
    { type: "eligibility:Professional", originalName: "eligibility.pdf", available: true },
  ]
  return { profile, resume: { id: 1, available: true }, files }
}

test("a complete profile is ready without changing password or disclosing optional salary grade", () => {
  const { profile, resume, files } = complete()
  assert.deepEqual(missingProfileFields(profile, resume, files), [])
})

test("monthly gross salary is optional for profile completion", () => {
  const { profile, resume, files } = complete()
  profile.experience[0].description = profile.experience[0].description.replace("Monthly Gross Salary: 24,000\n", "")
  assert.deepEqual(missingProfileFields(profile, resume, files), [])
})

test("a blank account lists missing sections and does not throw", () => {
  const missing = missingProfileFields(null)
  for (const label of ["Full name", "Profile picture", "Skills", "Personal Data Sheet (PDS)", "Portfolio"]) assert.ok(missing.includes(label))
  assert.ok(missing.some((label) => label.startsWith("Job Experience")))
})

test("invalid contact fields block completion", () => {
  const { profile, resume, files } = complete()
  profile.phone = "+63917"
  profile.email = "invalid"
  assert.deepEqual(missingProfileFields(profile, resume, files), ["Valid email address", "Valid phone number"])
})

test("LinkedIn is optional for profile completion", () => {
  const { profile, resume, files } = complete()
  delete profile.linkedInUrl
  assert.deepEqual(missingProfileFields(profile, resume, files), [])
})

test("Not Applicable is accepted for year graduated", () => {
  const { profile, resume, files } = complete()
  profile.education[0].description = profile.education[0].description.replace("Year Graduated: 2022", "Year Graduated: N/A")
  assert.deepEqual(missingProfileFields(profile, resume, files), [])
})

test("a saved COE filename alone cannot enable matching", () => {
  const { profile, resume, files } = complete()
  const missing = missingProfileFields(profile, resume, files.filter((file) => file.type !== "others"))
  assert.ok(missing.includes("Other supporting document"))
  assert.ok(missing.some((label) => label.startsWith("Job Experience")))
})

test("missing stored documents and PDS disable completion even when metadata exists", () => {
  const { profile, resume, files } = complete()
  resume.available = false
  files[0].available = false
  const missing = missingProfileFields(profile, resume, files)
  assert.ok(missing.includes("Personal Data Sheet (PDS)"))
  assert.ok(missing.includes("Certificate"))
  assert.ok(missing.some((label) => label.startsWith("Learning & Development")))
})

test("all existing education and experience records must have their required details", () => {
  const { profile, resume, files } = complete()
  profile.education.push({ schoolName: "Incomplete school" })
  profile.experience.push({ position: "Incomplete work" })
  const missing = missingProfileFields(profile, resume, files)
  assert.ok(missing.some((label) => label.startsWith("Education")))
  assert.ok(missing.some((label) => label.startsWith("Job Experience")))
})

test("supports API field names and equivalent Unicode filenames", () => {
  const { profile, resume, files } = complete()
  profile.full_name = profile.fullName
  delete profile.fullName
  profile.educations = profile.education.map(({ schoolName, startYear, endYear, ...item }) => ({ ...item, school_name: schoolName, start_year: startYear, end_year: endYear }))
  delete profile.education
  profile.experiences = profile.experience.map(({ companyName, startDate, endDate, ...item }) => ({ ...item, company_name: companyName, start_date: startDate, end_date: endDate }))
  delete profile.experience
  files[4].original_name = files[4].originalName.normalize("NFD")
  delete files[4].originalName
  assert.deepEqual(missingProfileFields(profile, resume, files), [])
})

test("removing a required record hides matching until the section is restored", () => {
  const { profile, resume, files } = complete()
  const training = profile.experience.pop()
  assert.ok(missingProfileFields(profile, resume, files).some((label) => label.startsWith("Learning & Development")))
  profile.experience.push(training)
  assert.deepEqual(missingProfileFields(profile, resume, files), [])
})
