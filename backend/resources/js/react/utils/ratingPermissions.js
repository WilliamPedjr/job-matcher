export function canManageRatings(user) {
  if (!user) return false
  const position = String(user.positionType || user.position_type || "").trim().toLowerCase()
  const role = String(user.role || "").trim().toLowerCase()
  return position !== "board" && role !== "board" && role !== "jobseeker"
}
