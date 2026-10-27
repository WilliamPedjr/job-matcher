const normalizedName = (name) => String(name || "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase()

export function experienceDocuments(item, files = []) {
  const names = new Set(String(item.description || "").split(/\r?\n/)
    .map((line) => normalizedName(line.match(/^\s*(?:coe|certificate) file:\s*(.+)$/i)?.[1]))
    .filter(Boolean))
  const matches = files.filter((doc) => doc.available !== false && names.has(normalizedName(doc.originalName || doc.original_name)))
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  const seen = new Set()
  return matches.filter((doc) => {
    const name = normalizedName(doc.originalName || doc.original_name)
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })
}
