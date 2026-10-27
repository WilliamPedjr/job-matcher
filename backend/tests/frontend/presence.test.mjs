import test from "node:test"
import assert from "node:assert/strict"
import { describePresence } from "../../resources/js/react/utils/presence.js"

const now = Date.parse("2026-10-23T04:00:00Z")
const account = (seconds, online = true) => ({ lastSeenAt: new Date(now - seconds * 1000).toISOString(), online })

test("online status expires after two minutes and cannot override server status", () => {
  assert.deepEqual(describePresence(account(119), now), { online: true, label: "Online" })
  assert.deepEqual(describePresence(account(120), now), { online: false, label: "Last active 2 minutes ago" })
  assert.equal(describePresence(account(20, false), now).online, false)
})

test("missing data is unavailable and never-seen accounts are offline", () => {
  assert.equal(describePresence(undefined, now).label, "Unavailable")
  assert.equal(describePresence({ lastSeenAt: null, online: false }, now).label, "Offline")
})

test("last activity uses readable minutes, hours, and days", () => {
  assert.equal(describePresence(account(180, false), now).label, "Last active 3 minutes ago")
  assert.equal(describePresence(account(3600, false), now).label, "Last active 1 hour ago")
  assert.equal(describePresence(account(172800, false), now).label, "Last active 2 days ago")
})
