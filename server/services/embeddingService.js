const { pipeline } = require('@xenova/transformers');

let extractor;

async function loadModel() {
  if (!extractor) {
    extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
}

async function getEmbedding(text) {
  await loadModel();
  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true
  });
  return Array.from(output.data);
}

module.exports = { getEmbedding };