const { pipeline } = require('@xenova/transformers');

let extractor;
const embeddingCache = new Map();
const MAX_EMBEDDING_CACHE_ENTRIES = 250;

function makeCacheKey(text) {
  return String(text || "").trim().slice(0, 4000);
}

function setCachedEmbedding(key, value) {
  if (!key) return;
  if (embeddingCache.has(key)) {
    embeddingCache.delete(key);
  }
  embeddingCache.set(key, value);

  if (embeddingCache.size > MAX_EMBEDDING_CACHE_ENTRIES) {
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey) {
      embeddingCache.delete(oldestKey);
    }
  }
}

async function loadModel() {
  if (!extractor) {
    extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
}

async function getEmbedding(text) {
  const cacheKey = makeCacheKey(text);
  if (cacheKey && embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }

  await loadModel();
  const output = await extractor(cacheKey, {
    pooling: 'mean',
    normalize: true
  });
  const embedding = Array.from(output.data);
  setCachedEmbedding(cacheKey, embedding);
  return embedding;
}

module.exports = { getEmbedding };
