const romanGrades = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" }

function tokens(value) {
  return String(value ?? "").toLowerCase().trim()
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/[(),]/g, " ")
    .split(/\s+/).filter(Boolean)
    .map((word) => Object.hasOwn(romanGrades, word) ? romanGrades[word] : word)
}

function withinOneEdit(left, right) {
  if (Math.abs(left.length - right.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (left.length <= right.length) j++
    if (left.length >= right.length) i++
  }
  return edits + (i < left.length || j < right.length ? 1 : 0) <= 1
}

export function matchesJobSearch(job, query) {
  const terms = tokens(query)
  if (!terms.length) return true
  const titleWords = tokens(job?.title)

  return terms.every((term) => {
    // Keep grade numbers exact so searching Instructor I does not include II or III.
    if (/^\d{1,2}$/.test(term)) return titleWords.includes(term)
    if (titleWords.some((word) => word.includes(term))) return true
    return term.length >= 5 && titleWords.some((word) => word.length >= 5 && withinOneEdit(word, term))
  })
}
