import test from "node:test"
import assert from "node:assert/strict"
import { matchesJobSearch } from "../../resources/js/react/utils/jobSearch.js"

const jobs = [
  { id: 1, title: "Instructor I", department: "College of Education" },
  { id: 2, title: "Intructor I", department: "College of Management and Economics" },
  { id: 3, title: "Instructor II", department: "College of Education" },
  { id: 4, title: "Instructor III" },
  { id: 5, title: "Instructor 11" },
]

test("both Instructor I postings appear despite the missing letter in one title", () => {
  for (const query of ["instructor i", "intructor i", "instructor 1", "intructor 1", " INSTRUCTOR   1 ", "instructor1"]) {
    assert.deepEqual(jobs.filter((job) => matchesJobSearch(job, query)).map((job) => job.id), [1, 2], query)
  }
})

test("separate postings with the same title remain separate search results", () => {
  const postings = [{ id: 7, title: "Instructor I" }, { id: 8, title: "Instructor I" }]
  assert.equal(postings.filter((job) => matchesJobSearch(job, "Instructor 1")).length, 2)
})

test("Instructor searches exclude Assistant Professor even when its description mentions instruction", () => {
  const postings = [
    { id: 42, title: "Instructor I", department: "College of Education" },
    { id: 43, title: "Assistant Professor I", description: "Handle instruction, research and extension activities." },
    { id: 45, title: "Instructor I", department: "College of Management and Economics" },
  ]
  for (const query of ["instruc", "instructor", "instructor i", "instructor 1"]) {
    assert.deepEqual(postings.filter((job) => matchesJobSearch(job, query)).map((job) => job.id), [42, 45], query)
  }
})

test("job grades remain distinct when searching with Roman or Arabic numbers", () => {
  for (const query of ["Instructor II", "Instructor 2"]) {
    assert.deepEqual(jobs.filter((job) => matchesJobSearch(job, query)).map((job) => job.id), [3])
  }
  assert.deepEqual(jobs.filter((job) => matchesJobSearch(job, "Instructor 11")).map((job) => job.id), [5])
})

test("search uses job titles without matching eligibility, department or other metadata", () => {
  const job = { title: "Administrative Officer III", department: "Finance", item_no: "LNU-123-2026", eligibility: "Career Service Professional" }
  for (const query of ["admin", "Officer 3"]) {
    assert.equal(matchesJobSearch(job, query), true, query)
  }
  for (const query of ["finance", "LNU-123", "2026", "career service", "profess", "engineering"]) {
    assert.equal(matchesJobSearch(job, query), false, query)
  }
})

test("profess matches Assistant Professor without matching Professional eligibility", () => {
  const postings = [
    { id: 1, title: "Administrative Officer III", eligibility: "Career Service Professional" },
    { id: 2, title: "Senior Administrative Assistant I", eligibility: "Career Service Professional" },
    { id: 3, title: "Assistant Professor I", eligibility: "Open to all qualified applicants" },
    { id: 4, title: "Administrative Officer II", eligibility: "Career Service Professional" },
  ]
  for (const query of ["profess", "professor", "Professor 1"]) {
    assert.deepEqual(postings.filter((job) => matchesJobSearch(job, query)).map((job) => job.id), [3], query)
  }
})

test("typo tolerance applies to longer title words without matching unrelated jobs", () => {
  assert.equal(matchesJobSearch({ title: "Instructor I" }, "instructr 1"), true)
  assert.equal(matchesJobSearch({ title: "Accountant I" }, "instructor 1"), false)
  assert.equal(matchesJobSearch({ title: "Instructor II" }, "instructor 1"), false)
  assert.equal(matchesJobSearch({ title: "Instructor I" }, "x"), false)
})

test("empty searches and missing fields are safe", () => {
  assert.equal(matchesJobSearch(null, ""), true)
  assert.equal(matchesJobSearch({}, "   "), true)
  assert.equal(matchesJobSearch(null, "Instructor I"), false)
  assert.equal(matchesJobSearch({ title: "Constructor" }, "constructor"), true)
})
