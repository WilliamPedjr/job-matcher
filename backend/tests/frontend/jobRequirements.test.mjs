import test from "node:test"
import assert from "node:assert/strict"
import { buildJobRequirements } from "../../resources/js/react/utils/jobRequirements.js"

const job = {
  eligibility: "Career Service Professional/Second Level Eligibility",
  minimumEducation: "Bachelor degree",
  minimumExperienceYears: 2,
  requiredSkills: "Records Management, Microsoft Excel"
}
const complete = {
  eligibility_match_score: 100,
  eligibility_lines: ["Career Service Professional Second Level Eligibility"],
  education_match_score: 100,
  education_text: "Bachelor of Science in Information Technology",
  experience_match_score: 100,
  experience_text: "Administrative Officer, 3 years",
  skills_match_score: 100,
  matched_skills: ["Records Management", "Microsoft Excel"],
  missing_skills: []
}
const byKey = (rows, key) => rows.find((item) => item.key === key)

test("shows missing eligibility and education even when the overall score permits applying", () => {
  const rows = buildJobRequirements(job, {
    ...complete, overall_score: 70,
    eligibility_match_score: 0, eligibility_lines: [],
    education_match_score: 50, education_text: "High School graduate"
  }, "ready")
  assert.equal(byKey(rows, "eligibility").state, "missing")
  assert.equal(byKey(rows, "education").state, "incomplete")
  assert.equal(byKey(rows, "education").requirement, "Bachelor degree")
  assert.deepEqual(byKey(rows, "education").evidence, ["High School graduate"])
  assert.match(byKey(rows, "eligibility").action, /certificate/)
})

test("shows met requirements from the existing analysis", () => {
  assert.ok(buildJobRequirements(job, complete, "ready").every((item) => item.state === "met"))
})

test("shows missing education when no education evidence is available", () => {
  const row = byKey(buildJobRequirements(job, {
    ...complete, education_match_score: 50, education_text: ""
  }, "ready"), "education")
  assert.equal(row.state, "missing")
  assert.match(row.action, /education in Profile/)
})

test("keeps unchecked requirements distinct from missing information", () => {
  for (const status of ["idle", "loading", "missing", "error"]) {
    const rows = buildJobRequirements(job, complete, status)
    assert.ok(rows.every((item) => item.state === "unchecked"))
  }
})

test("does not invent a result when a category score is absent or invalid", () => {
  for (const score of [undefined, null, "", "invalid"]) {
    const rows = buildJobRequirements(job, { ...complete, eligibility_match_score: score }, "ready")
    assert.equal(byKey(rows, "eligibility").state, "unchecked")
  }
})

test("does not flag optional requirements as missing", () => {
  const rows = buildJobRequirements({
    eligibility: "None required", minimumEducation: "Open to all education levels",
    minimumExperienceYears: 0, requiredSkills: "N/A"
  }, null, "missing")
  assert.ok(rows.every((item) => item.state === "optional"))
})

test("accepts snake case job fields and displays missing skills", () => {
  const rows = buildJobRequirements({
    minimum_education: "Master degree", minimum_experience_years: 3,
    required_skills: ["Records Management", "Microsoft Excel"]
  }, { ...complete, skills_match_score: 50, missing_skills: ["Microsoft Excel"] }, "ready")
  assert.equal(byKey(rows, "education").requirement, "Master degree")
  assert.equal(byKey(rows, "experience").requirement, "3 years")
  assert.equal(byKey(rows, "skills").state, "incomplete")
  assert.deepEqual(byKey(rows, "skills").missing, ["Microsoft Excel"])
})

test("displays training hours as training rather than missing skills", () => {
  const rows = buildJobRequirements({ ...job, requiredSkills: "16 hours relevant training" }, {
    ...complete, training_match_score: 50, training_text: "8 training hours",
    missing_training: ["16 required training hours"]
  }, "ready")
  const training = byKey(rows, "training")
  assert.equal(training.state, "incomplete")
  assert.deepEqual(training.missing, ["16 required training hours"])
  assert.equal(byKey(rows, "skills"), undefined)
})

test("uses the score breakdown when direct category scores are absent", () => {
  const rows = buildJobRequirements(job, {
    resume_summary: { score_breakdown: { eligibility: 0, education: 100, experience: 50, skills: 0 } }
  }, "ready")
  assert.equal(byKey(rows, "eligibility").state, "missing")
  assert.equal(byKey(rows, "education").state, "met")
  assert.equal(byKey(rows, "experience").state, "missing")
})

test("handles empty job details safely", () => {
  assert.ok(buildJobRequirements().every((item) => item.state === "optional"))
})
