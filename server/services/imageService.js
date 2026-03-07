const { ocrImage, ocrFallback } = require('./ocrService');

async function extractTextFromImage(filePath) {
  let text = "";

  try {
    text = await ocrImage(filePath);
  } catch (err) {
    console.warn(`ocrImage failed, using fallback: ${err.message}`);
  }

  if (!text || text.trim().length < 30) {
    text = await ocrFallback(filePath);
  }

  return text;
}

module.exports = { extractTextFromImage };
