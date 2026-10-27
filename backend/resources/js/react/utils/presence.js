export function describePresence(account, now = Date.now()) {
  if (!account) return { online: false, label: "Unavailable" }
  const seenAt = Date.parse(account.lastSeenAt)
  if (!Number.isFinite(seenAt)) return { online: false, label: "Offline" }
  const elapsed = Math.max(0, now - seenAt)
  if (account.online && elapsed < 120000) return { online: true, label: "Online" }
  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 1) return { online: false, label: "Last active just now" }
  if (minutes < 60) return { online: false, label: `Last active ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago` }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { online: false, label: `Last active ${hours} ${hours === 1 ? "hour" : "hours"} ago` }
  const days = Math.floor(hours / 24)
  return { online: false, label: `Last active ${days} ${days === 1 ? "day" : "days"} ago` }
}
