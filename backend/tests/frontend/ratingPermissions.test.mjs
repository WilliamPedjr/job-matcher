import test from "node:test"
import assert from "node:assert/strict"
import { canManageRatings } from "../../resources/js/react/utils/ratingPermissions.js"

test("board accounts cannot edit criteria or export regardless of page access", () => {
  for (const user of [
    { role: "employer", positionType: "board" },
    { role: "employer", position_type: "board", page_access: ["ratings", "applicants"] },
    { role: "employer", positionType: " BOARD " },
    { role: "board" },
  ]) assert.equal(canManageRatings(user), false)
})

test("personnel and administrators retain criteria and export access", () => {
  for (const user of [
    { role: "employer", positionType: "personnel" },
    { role: "employer", position_type: "personnel" },
    { role: "admin" },
    { role: "staff" },
  ]) assert.equal(canManageRatings(user), true)
})

test("job seekers and missing sessions do not receive management actions", () => {
  assert.equal(canManageRatings(null), false)
  assert.equal(canManageRatings(undefined), false)
  assert.equal(canManageRatings({ role: "jobseeker" }), false)
})
