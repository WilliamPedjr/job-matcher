const NOTIFICATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

export function getNotificationExpiresAt(item) {
  return Date.parse(item?.uploaded_at) + NOTIFICATION_LIFETIME_MS
}

export function isNotificationActive(item, now = Date.now()) {
  return getNotificationExpiresAt(item) > now
}
