const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const OCR_API_KEY = "K88892339788957";

let sharpLib;
let tesseractLib;
let pdfPoppler;

function getSharp() {
  if (!sharpLib) {
    sharpLib = require('sharp');
  }
  return sharpLib;
}

function getTesseract() {
  if (!tesseractLib) {
    tesseractLib = require('tesseract.js');
  }
  return tesseractLib;
}

function getPdfPoppler() {
  if (!pdfPoppler) {
    pdfPoppler = require('pdf-poppler');
  }
  return pdfPoppler;
}

// Preprocess image and run Tesseract OCR
async function ocrImage(imagePath) {
  const Tesseract = getTesseract();
  const preprocessedPath = `${imagePath}-pre.png`;
  let inputForOcr = imagePath;
  let usedPreprocessed = false;

  try {
    const sharp = getSharp();
    await sharp(imagePath)
      .grayscale()
      .resize({ width: 1800 })
      .normalize()
      .sharpen()
      .toFile(preprocessedPath);

    inputForOcr = preprocessedPath;
    usedPreprocessed = true;
  } catch (err) {
    console.warn(`Sharp preprocessing skipped: ${err.message}`);
  }

  const ocrResult = await Tesseract.recognize(inputForOcr, 'eng', {
    tessedit_pageseg_mode: Tesseract.PSM.AUTO
  });

  if (usedPreprocessed && fs.existsSync(preprocessedPath)) {
    fs.unlinkSync(preprocessedPath);
  }

  return ocrResult.data.text;
}

// Fallback OCR using OCR.space
async function ocrFallback(filePath) {
  const formData = new FormData();
  formData.append("file", fs.createReadStream(filePath));
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");

  const response = await axios.post("https://api.ocr.space/parse/image", formData, {
    headers: { apikey: OCR_API_KEY, ...formData.getHeaders() },
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  return response.data?.ParsedResults?.[0]?.ParsedText || "";
}

// Convert scanned PDF pages to text via OCR
async function ocrPdf(filePath) {
  const poppler = getPdfPoppler();
  const outputDir = "uploads/";
  const outputPrefix = `converted_${Date.now()}`;
  const options = { format: 'png', out_dir: outputDir, out_prefix: outputPrefix };
  await poppler.convert(filePath, options);

  const imageFiles = fs.readdirSync(outputDir)
    .filter(f => f.startsWith(outputPrefix) && f.endsWith(".png"))
    .map(f => `${outputDir}${f}`);

  const texts = await Promise.all(imageFiles.map(img => ocrImage(img)));

  imageFiles.forEach(f => fs.unlinkSync(f));

  return texts.join("\n\n");
}

module.exports = { ocrImage, ocrFallback, ocrPdf };
