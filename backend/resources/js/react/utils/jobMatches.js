export function jobMatchKey(job = {}) {
  if (job.source !== "template" && job.id != null && String(job.id).trim() !== "") {
    return `job:${job.id}`
  }
  const title = String(job.title ?? job.key ?? "").trim().toLowerCase()
  return title ? `title:${title}` : ""
}

export function buildJobMatchMap(results = []) {
  const matches = {}
  for (const item of results) {
    if (!item) continue
    const key = jobMatchKey(item)
    if (!key) continue
    const score = item.score == null || item.score === "" ? NaN : Number(item.score)
    const minimumScore = Number(item.minimumScore ?? 50)
    const threshold = Number.isFinite(minimumScore) ? minimumScore : 50
    matches[key] = {
      score: Number.isFinite(score) ? score : null,
      qualifies: Number.isFinite(score) && score >= threshold && item.allowApplication === true,
      minimumScore: threshold
    }
  }
  return matches
}
