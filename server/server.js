// Core imports
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const mysql = require("mysql2/promise");
const matchRoute = require('./routes/match');
const { extractTextFromPdf } = require("./services/pdfService");
const { extractTextFromImage } = require("./services/imageService");
const { matchJobs } = require("./services/jobMatcher");
const jobs = require("./jobs.json");

// Environment configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api', matchRoute);

// Local uploads directory setup
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "capstone_db",
  waitForConnections: true,
  connectionLimit: 10
});

// Database initialization
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      original_name VARCHAR(255) NOT NULL,
      saved_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(100),
      size_bytes BIGINT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Backward-compatible schema updates for existing tables.
  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN name VARCHAR(255) NULL AFTER id");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN email VARCHAR(255) NULL AFTER name");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN phone VARCHAR(50) NULL AFTER email");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN matched_job_title VARCHAR(255) NULL AFTER phone");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN match_score DECIMAL(6,2) NULL AFTER matched_job_title");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN classification VARCHAR(100) NULL AFTER match_score");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN matched_skills TEXT NULL AFTER classification");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN extracted_text LONGTEXT NULL AFTER matched_skills");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN missing_skills TEXT NULL AFTER extracted_text");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN project_score DECIMAL(6,2) NULL AFTER match_score");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
};

const analyzeResumeData = async (filePath, mimeType) => {
  let extractedText = "";

  if (mimeType === "application/pdf") {
    extractedText = await extractTextFromPdf(filePath);
  } else if (mimeType && mimeType.startsWith("image/")) {
    extractedText = await extractTextFromImage(filePath);
  } else {
    const error = new Error("Unsupported file type. Upload PDF or image.");
    error.statusCode = 400;
    throw error;
  }

  if (!extractedText || extractedText.trim().length < 30) {
    const error = new Error("Could not extract readable text from CV.");
    error.statusCode = 400;
    throw error;
  }

  const cvText = extractedText.replace(/\s+/g, " ").trim().slice(0, 4000);
  const extractedTextForStorage = extractedText.trim().slice(0, 20000);
  const matchResults = await matchJobs(cvText, jobs);
  const topMatch = matchResults?.[0] || null;
  const matchedJobTitle = topMatch?.title || null;
  const matchScore = topMatch?.score ? Number(topMatch.score) : null;
  const projectScore = topMatch?.projectScore ? Number(topMatch.projectScore) : null;
  const classification = topMatch?.classification || null;
  const topMissingSkills = Array.isArray(topMatch?.missingSkills) ? topMatch.missingSkills : [];
  const allMatchedSkills = Array.from(
    new Set(
      (matchResults || [])
        .flatMap((item) => (Array.isArray(item.matchedSkills) ? item.matchedSkills : []))
        .filter(Boolean)
    )
  );
  const matchedSkills = allMatchedSkills.length ? allMatchedSkills.join(", ") : null;
  const missingSkills = topMissingSkills.length ? topMissingSkills.join(", ") : null;

  return {
    extractedTextForStorage,
    matchedJobTitle,
    matchScore,
    projectScore,
    classification,
    matchedSkills,
    missingSkills
  };
};

// Health route
app.get("/api", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const { name = "", email = "", phone = "" } = req.body;
  if (!name.trim() || !email.trim() || !phone.trim()) {
    return res.status(400).json({ message: "Name, email, and phone are required." });
  }

  try {
    const { originalname, filename, path: savedPath, mimetype, size } = req.file;
    const {
      extractedTextForStorage,
      matchedJobTitle,
      matchScore,
      projectScore,
      classification,
      matchedSkills,
      missingSkills
    } = await analyzeResumeData(savedPath, mimetype);

    const [result] = await pool.execute(
      `
        INSERT INTO uploads (
          name, email, phone, matched_job_title, match_score, project_score, classification, matched_skills, extracted_text, missing_skills,
          original_name, saved_name, file_path, mime_type, size_bytes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name.trim(),
        email.trim(),
        phone.trim(),
        matchedJobTitle,
        matchScore,
        projectScore,
        classification,
        matchedSkills,
        extractedTextForStorage,
        missingSkills,
        originalname,
        filename,
        savedPath,
        mimetype,
        size
      ]
    );

    res.status(201).json({
      message: "Applicant analyzed and added successfully!",
      id: result.insertId,
      file: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        matchedJobTitle,
        matchScore,
        projectScore,
        classification,
        matchedSkills,
        extractedText: extractedTextForStorage,
        missingSkills,
        originalName: originalname,
        savedName: filename,
        mimeType: mimetype,
        sizeBytes: size
      }
    });
  } catch (error) {
    console.error("Upload DB error:", error);
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to save file metadata to MySQL." });
  }
});

app.put("/uploads/:id/reanalyze", upload.single("file"), async (req, res) => {
  const { id } = req.params;
  let newUploadedPath = null;

  try {
    const [rows] = await pool.execute(
      "SELECT id, name, email, phone, original_name, saved_name, file_path, mime_type, size_bytes, uploaded_at FROM uploads WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Upload not found." });
    }

    const current = rows[0];
    const oldFilePath = current.file_path;

    let filePath = current.file_path;
    let mimeType = current.mime_type;
    let originalName = current.original_name;
    let savedName = current.saved_name;
    let sizeBytes = current.size_bytes;

    if (req.file) {
      filePath = req.file.path;
      mimeType = req.file.mimetype;
      originalName = req.file.originalname;
      savedName = req.file.filename;
      sizeBytes = req.file.size;
      newUploadedPath = req.file.path;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Source file for re-analysis is missing." });
    }

    const {
      extractedTextForStorage,
      matchedJobTitle,
      matchScore,
      projectScore,
      classification,
      matchedSkills,
      missingSkills
    } = await analyzeResumeData(filePath, mimeType);

    await pool.execute(
      `
        UPDATE uploads
        SET original_name = ?, saved_name = ?, file_path = ?, mime_type = ?, size_bytes = ?,
            matched_job_title = ?, match_score = ?, project_score = ?, classification = ?, matched_skills = ?, extracted_text = ?, missing_skills = ?
        WHERE id = ?
      `,
      [
        originalName,
        savedName,
        filePath,
        mimeType,
        sizeBytes,
        matchedJobTitle,
        matchScore,
        projectScore,
        classification,
        matchedSkills,
        extractedTextForStorage,
        missingSkills,
        id
      ]
    );

    if (req.file && oldFilePath && oldFilePath !== filePath) {
      const resolvedOldPath = path.resolve(oldFilePath);
      const resolvedUploadsDir = path.resolve(uploadsDir);
      if (resolvedOldPath.startsWith(resolvedUploadsDir) && fs.existsSync(resolvedOldPath)) {
        try {
          await fs.promises.unlink(resolvedOldPath);
        } catch (unlinkError) {
          if (unlinkError.code !== "ENOENT") {
            console.error("Old file delete error:", unlinkError);
          }
        }
      }
    }

    const [updatedRows] = await pool.execute(
      "SELECT id, name, email, phone, matched_job_title, match_score, project_score, classification, matched_skills, extracted_text, missing_skills, original_name, saved_name, file_path, mime_type, size_bytes, uploaded_at FROM uploads WHERE id = ?",
      [id]
    );

    res.json({
      message: "Applicant re-analyzed and updated successfully!",
      upload: updatedRows[0]
    });
  } catch (error) {
    console.error("Re-analyze error:", error);
    if (newUploadedPath && fs.existsSync(newUploadedPath)) {
      try {
        await fs.promises.unlink(newUploadedPath);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.error("Cleanup error:", cleanupError);
        }
      }
    }
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to re-analyze applicant." });
  }
});

// List uploads route
app.get("/uploads", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, phone, matched_job_title, match_score, project_score, classification, matched_skills, extracted_text, missing_skills, original_name, saved_name, file_path, mime_type, size_bytes, uploaded_at FROM uploads ORDER BY uploaded_at DESC"
    );

    res.json(rows);
  } catch (error) {
    console.error("Fetch uploads error:", error);
    res.status(500).json({ message: "Failed to fetch uploads." });
  }
});

// Download route
app.get("/uploads/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      "SELECT original_name, file_path FROM uploads WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Upload not found." });
    }

    const fileRecord = rows[0];
    if (!fs.existsSync(fileRecord.file_path)) {
      return res.status(404).json({ message: "File no longer exists on disk." });
    }

    res.download(fileRecord.file_path, fileRecord.original_name);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ message: "Failed to download file." });
  }
});

// Delete upload record route
app.delete("/uploads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute("SELECT file_path FROM uploads WHERE id = ?", [id]);

    if (!rows.length) {
      return res.status(404).json({ message: "Upload not found." });
    }

    const filePath = rows[0].file_path;

    const [result] = await pool.execute("DELETE FROM uploads WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Upload not found." });
    }

    // Delete file from disk after DB record is removed.
    if (filePath) {
      const resolvedFilePath = path.resolve(filePath);
      const resolvedUploadsDir = path.resolve(uploadsDir);

      if (resolvedFilePath.startsWith(resolvedUploadsDir)) {
        try {
          await fs.promises.unlink(resolvedFilePath);
        } catch (unlinkError) {
          if (unlinkError.code !== "ENOENT") {
            console.error("File delete error:", unlinkError);
          }
        }
      } else {
        console.error("Skipped file delete: path outside uploads directory.", resolvedFilePath);
      }
    }

    res.json({ message: "Upload record and file deleted." });
  } catch (error) {
    console.error("Delete upload error:", error);
    res.status(500).json({ message: "Failed to delete upload record/file." });
  }
});

// App startup
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
