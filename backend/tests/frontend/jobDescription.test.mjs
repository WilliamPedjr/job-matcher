import test from "node:test"
import assert from "node:assert/strict"
import { jobDescriptionForPosition } from "../../resources/js/react/utils/jobDescription.js"

test("generates a description for any entered position", () => {
  const description = jobDescriptionForPosition("  Administrative   Officer II  ")
  assert.ok(description.includes("Administrative Officer II"))
  assert.ok(description.includes("Leyte Normal University"))
})

test("changing the position updates the generated role without retaining the old title", () => {
  const first = jobDescriptionForPosition("Teacher")
  const next = jobDescriptionForPosition("Accountant")
  assert.ok(first.includes("Teacher"))
  assert.ok(next.includes("Accountant"))
  assert.ok(!next.includes("Teacher"))
})

test("uses saved template descriptions and includes the exact position", () => {
  assert.equal(jobDescriptionForPosition("Accountant", "Maintain financial records."), "Accountant\n\nMaintain financial records.")
  assert.equal(jobDescriptionForPosition("Accountant", "The Accountant maintains records."), "The Accountant maintains records.")
})

test("replaces template position placeholders literally", () => {
  assert.equal(jobDescriptionForPosition("Research & Development $&", "We need a {{job_position}}. The [Job Position] supports operations."),
    "We need a Research & Development $&. The Research & Development $& supports operations.")
})

test("waits for a position before generating a description", () => {
  assert.equal(jobDescriptionForPosition("   "), "")
  assert.equal(jobDescriptionForPosition(null, "Template description"), "")
})
