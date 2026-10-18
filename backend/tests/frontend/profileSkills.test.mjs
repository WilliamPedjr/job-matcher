import test from "node:test"
import assert from "node:assert/strict"
import { normalizeSkills, combinedSkills, validateLearnedSkills } from "../../resources/js/react/utils/profileSkills.js"

test("splits entered skills and removes duplicate casing and whitespace", () => {
  assert.deepEqual(normalizeSkills(" Data   Analysis, Teamwork\nDATA Analysis; Public Speaking, "), ["Data Analysis", "Teamwork", "Public Speaking"])
})

test("combines work and training skills while preserving distinct programming languages", () => {
  assert.deepEqual(combinedSkills([{ skills: ["C++", "Teamwork"] }, { skills: ["teamwork", "C#", "C"] }]), ["C++", "Teamwork", "C#", "C"])
})

test("editing and deleting source records updates the compiled list", () => {
  const work = { skills: ["Data Analysis", "Teamwork"] }
  const training = { skills: ["Teamwork", "Public Speaking"] }
  work.skills = ["Microsoft Excel"]
  assert.deepEqual(combinedSkills([work, training]), ["Microsoft Excel", "Teamwork", "Public Speaking"])
  assert.deepEqual(combinedSkills([work]), ["Microsoft Excel"])
  assert.deepEqual(combinedSkills([]), [])
})

test("legacy records with no skills remain editable", () => {
  assert.deepEqual(combinedSkills([{}, { skills: null }]), [])
  assert.equal(validateLearnedSkills(""), "")
})

test("validates limits before submitting", () => {
  assert.match(validateLearnedSkills("x".repeat(101)), /100 characters/)
  assert.match(validateLearnedSkills(Array.from({ length: 101 }, (_, index) => `Skill ${index}`)), /100 skills/)
})
