import test from "node:test"
import assert from "node:assert/strict"
import { isHourlyEmployment, monthlySalaryForGrade } from "../../resources/js/react/utils/salaryGrades.js"

test("every integer grade from 1 through 33 has a monthly salary", () => {
  for (let grade = 1; grade <= 33; grade++) {
    assert.ok(Number.isInteger(monthlySalaryForGrade(grade)))
  }
})

test("monthly salaries follow the supplied schedule, including the highest grades", () => {
  for (const [grade, salary] of [[1, 13000], [9, 21211], [10, 23176], [15, 36619], [20, 57347], [30, 189199], [31, 278434], [32, 331954], [33, 419144]]) {
    assert.equal(monthlySalaryForGrade(grade), salary)
    assert.equal(monthlySalaryForGrade(String(grade)), salary)
  }
  assert.equal(monthlySalaryForGrade("09"), 21211)
})

test("missing or invalid grades never produce a salary for another grade", () => {
  for (const grade of [null, undefined, "", " ", 0, -1, 34, 100, 1.5, "1.5", "Grade 15", "abc"]) {
    assert.equal(monthlySalaryForGrade(grade), null)
  }
})

test("Contract of Service and Part-time use hourly rates", () => {
  for (const type of ["Contract of Service", " contract  OF service ", "Part-time", "Part Time"]) {
    assert.equal(isHourlyEmployment(type), true)
  }
  for (const type of ["Permanent", "Temporary", "Contractual", "Full-time", "Internship", null]) {
    assert.equal(isHourlyEmployment(type), false)
  }
})
