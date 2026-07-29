export function getArchiveActorHeaders(currentUser = null) {
  let user = currentUser
  if (!user) {
    try {
      const stored = window.localStorage.getItem("currentUser")
      user = stored ? JSON.parse(stored) : null
    } catch {
      user = null
    }
  }

  const name = String(user?.name || user?.fullName || user?.full_name || user?.companyName || user?.company_name || user?.email || "").trim()
  const email = String(user?.email || "").trim()
  const role = String(user?.role || "").trim()
  const headers = {}

  if (name) headers["X-Actor-Name"] = name
  if (email) headers["X-Actor-Email"] = email
  if (role) headers["X-Actor-Role"] = role

  return headers
}
