const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { extractTextFromPdf } = require('../services/pdfService');
const { extractTextFromImage } = require('../services/imageService');
const { matchJobs } = require('../services/jobMatcher');
const jobs = require('../jobs.json');

const router = express.Router();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/match', upload.single('cv'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "CV file is required" });

    filePath = req.file.path;
    const mimeType = req.file.mimetype;
    let extractedText = "";

    if (mimeType === 'application/pdf') {
      extractedText = await extractTextFromPdf(filePath);
    } else if (mimeType.startsWith('image/')) {
      extractedText = await extractTextFromImage(filePath);
    } else {
      return res.status(400).json({ success: false, error: "Unsupported file type. Upload PDF or image." });
    }

    if (!extractedText || extractedText.trim().length < 30) {
      return res.status(400).json({ success: false, error: "Could not extract readable text from CV." });
    }

    const cvText = extractedText.replace(/\s+/g, " ").trim().slice(0, 4000);
    const results = await matchJobs(cvText, jobs);

    res.json({
      success: true,
      previewText: cvText.substring(0, 1000),
      matches: results
    });

  } catch (err) {
    console.error("MATCH ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

module.exports = router;
