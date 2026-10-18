// Monthly amounts supplied for this application's salary grade schedule.
const monthlySalaries = Object.freeze([
  13000, 13819, 14678, 15586, 16543, 17553, 18620, 19744, 21211,
  23176, 27000, 29165, 31320, 33843, 36619, 39672, 43030, 46725,
  51357, 57347, 63997, 71511, 80003, 90078, 102690, 116040,
  131124, 148171, 167432, 189199, 278434, 331954, 419144,
])

export function monthlySalaryForGrade(grade) {
  const value = String(grade ?? "").trim()
  if (!/^\d{1,2}$/.test(value)) return null
  return monthlySalaries[Number(value) - 1] ?? null
}
