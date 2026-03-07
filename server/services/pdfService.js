const fs = require('fs');
const pdfParse = require('pdf-parse');
const { ocrPdf, ocrFallback } = require('./ocrService');

async function extractTextFromPdf(filePath) {
  const pdfBuffer = fs.readFileSync(filePath);
  let text = "";

  try {
    const pdfData = await pdfParse(pdfBuffer);
    text = pdfData.text;
  } catch (err) {
    console.warn(`pdfParse failed, trying OCR: ${err.message}`);
  }

  if (!text || text.trim().length < 30) {
    try {
      text = await ocrPdf(filePath);
    } catch (err) {
      console.warn(`ocrPdf failed, trying fallback: ${err.message}`);
    }
  }

  if (!text || text.trim().length < 30) {
    text = await ocrFallback(filePath);
  }

  return text;
}

module.exports = { extractTextFromPdf };
