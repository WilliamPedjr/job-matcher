import test from "node:test"
import assert from "node:assert/strict"
import { buildJobMatchMap, jobMatchKey } from "../../resources/js/react/utils/jobMatches.js"

test("same-title postings retain their own scores and application eligibility regardless of response order", () => {
  const results = [
    { id: 11, key: "instructor i", score: 0, allowApplication: false },
    { id: 12, key: "instructor i", score: 100, allowApplication: true }
  ]
  for (const order of [results, [...results].reverse()]) {
    const matches = buildJobMatchMap(order)
    assert.equal(matches[jobMatchKey({ id: 11, title: "Instructor I" })].qualifies, false)
    assert.equal(matches[jobMatchKey({ id: 11, title: "Instructor I" })].score, 0)
    assert.equal(matches[jobMatchKey({ id: "12", title: "Instructor I" })].qualifies, true)
  }
})

test("score alone never overrides a server application block", () => {
  const matches = buildJobMatchMap([
    { id: 1, score: 100, allowApplication: false },
    { id: 2, score: 40, minimumScore: 50, allowApplication: true },
    { id: 3, score: null, allowApplication: true },
    { id: 4, score: "invalid", allowApplication: true },
    { id: 5, score: 50, allowApplication: true }
  ])
  for (const id of [1, 2, 3, 4]) assert.equal(matches[`job:${id}`].qualifies, false)
  assert.equal(matches['job:5'].qualifies, true)
})

test("title fallback is isolated from real job IDs", () => {
  const matches = buildJobMatchMap([{ id: null, key: " instructor i ", score: 100, allowApplication: true }])
  assert.equal(matches[jobMatchKey({ source: "template", id: 11, title: "Instructor I" })].qualifies, true)
  assert.equal(matches[jobMatchKey({ id: 11, title: "Instructor I" })], undefined)
})
