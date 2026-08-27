import { pipeline, env } from '@xenova/transformers'
import { readFile } from 'node:fs/promises'

env.allowLocalModels = true
env.allowRemoteModels = true

const inputPath = process.argv[2]

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000)
}

function meanPool(output) {
  if (Array.isArray(output?.data)) {
    return output.data
  }

  if (ArrayBuffer.isView(output?.data)) {
    return Array.from(output.data)
  }

  if (output?.tolist) {
    const value = output.tolist()
    return Array.isArray(value?.[0]) ? value[0] : value
  }

  return []
}

function cosineSimilarity(left, right) {
  const length = Math.min(left.length, right.length)
  if (!length) return 0

  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (let index = 0; index < length; index += 1) {
    const a = Number(left[index] || 0)
    const b = Number(right[index] || 0)
    dot += a * b
    leftMagnitude += a * a
    rightMagnitude += b * b
  }

  if (!leftMagnitude || !rightMagnitude) return 0
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}

try {
  if (!inputPath) {
    throw new Error('Missing input path.')
  }

  const input = JSON.parse(await readFile(inputPath, 'utf8'))
  const resumeText = normalizeText(input.resumeText)
  const jobText = normalizeText(input.jobText)

  if (!resumeText || !jobText) {
    throw new Error('Resume text and job text are required.')
  }

  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  const resumeEmbedding = meanPool(await extractor(resumeText, { pooling: 'mean', normalize: true }))
  const jobEmbedding = meanPool(await extractor(jobText, { pooling: 'mean', normalize: true }))
  const similarity = Math.max(0, Math.min(1, cosineSimilarity(resumeEmbedding, jobEmbedding)))

  process.stdout.write(JSON.stringify({
    model: 'Xenova/all-MiniLM-L6-v2',
    similarity,
    score: Math.round(similarity * 10000) / 100,
  }))
} catch (error) {
  process.stderr.write(String(error?.message || error))
  process.exit(1)
}
