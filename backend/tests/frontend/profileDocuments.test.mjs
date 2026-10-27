import test from "node:test"
import assert from "node:assert/strict"
import { experienceDocuments } from "../../resources/js/react/utils/profileDocuments.js"

test("duplicate training uploads produce one link to the latest upload", () => {
  const files = [{ id: 2, originalName: "certificate.jpg" }, { id: 5, originalName: "certificate.jpg" }]
  assert.deepEqual(experienceDocuments({ description: "Certificate File: certificate.jpg" }, files), [files[1]])
  assert.deepEqual(files.map((file) => file.id), [2, 5])
})

test("deduplicates equivalent COE filenames across API field names and Unicode forms", () => {
  const files = [{ id: 3, originalName: "Regaña.pdf" }, { id: 4, original_name: "REGAÑA.pdf".normalize("NFD") }]
  assert.deepEqual(experienceDocuments({ description: "COE File: Regaña.pdf" }, files), [files[1]])
})

test("selects the latest available file without linking missing or unrelated uploads", () => {
  const files = [{ id: 1, originalName: "coe.pdf" }, { id: 2, originalName: "coe.pdf", available: false }, { id: 3, originalName: "other.pdf" }]
  assert.deepEqual(experienceDocuments({ description: "COE File: coe.pdf" }, files), [files[0]])
  assert.deepEqual(experienceDocuments({ description: "COE File: missing.pdf" }, files), [])
})
