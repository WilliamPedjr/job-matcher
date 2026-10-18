import test from "node:test"
import assert from "node:assert/strict"
import { getNotificationExpiresAt, isNotificationActive } from "../../resources/js/react/utils/notifications.js"

test("notifications expire exactly seven days after submission, read or unread", () => {
  for (const read of [true, false]) {
    const item = { uploaded_at: "2026-10-10T08:00:00.000Z", read }
    const expiresAt = Date.parse("2026-10-17T08:00:00.000Z")
    assert.equal(getNotificationExpiresAt(item), expiresAt)
    assert.equal(isNotificationActive(item, expiresAt - 1), true)
    assert.equal(isNotificationActive(item, expiresAt), false)
    assert.equal(isNotificationActive(item, expiresAt + 1), false)
  }
})

test("expiration uses the submission timezone and stays expired after reloading", () => {
  const item = { uploaded_at: "2026-10-10T16:00:00+08:00" }
  const now = Date.parse("2026-10-18T08:00:00Z")
  assert.equal(getNotificationExpiresAt(item), Date.parse("2026-10-17T08:00:00Z"))
  assert.equal(isNotificationActive(JSON.parse(JSON.stringify(item)), now), false)
})

test("missing or invalid submission dates do not create permanent notifications", () => {
  for (const item of [undefined, {}, { uploaded_at: null }, { uploaded_at: "invalid" }]) {
    assert.equal(isNotificationActive(item), false)
  }
})
