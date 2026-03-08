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

// Environment configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const jobsSeedPath = path.join(__dirname, "jobs.json");

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

const readJobsSeed = () => {
  try {
    const raw = fs.readFileSync(jobsSeedPath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Read jobs seed error:", error);
    return [];
  }
};

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

const getJobsFromDb = async () => {
  const [rows] = await pool.query(
    `
      SELECT
        id, title, description, status, department, location, type,
        required_skills AS requiredSkills,
        minimum_education AS minimumEducation,
        minimum_experience_years AS minimumExperienceYears,
        salary_min AS salaryMin,
        salary_max AS salaryMax
      FROM jobs
      ORDER BY id ASC
    `
  );
  return rows;
};

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
    await pool.query("ALTER TABLE uploads ADD COLUMN applied_job_title VARCHAR(255) NULL AFTER phone");
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL UNIQUE,
      description LONGTEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      department VARCHAR(255) NULL,
      location VARCHAR(255) NULL,
      type VARCHAR(100) NULL,
      required_skills TEXT NULL,
      minimum_education VARCHAR(255) NULL,
      minimum_experience_years INT NOT NULL DEFAULT 0,
      salary_min DECIMAL(12,2) NULL,
      salary_max DECIMAL(12,2) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Keep jobs.json as pre-made templates and sync them into DB at startup.
  const seedJobs = readJobsSeed();
  for (const seed of seedJobs) {
    if (!seed?.title || !seed?.description) continue;
    await pool.execute(
      `
        INSERT INTO jobs (
          title, description, status, department, location, type,
          required_skills, minimum_education, minimum_experience_years, salary_min, salary_max
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          description = VALUES(description),
          status = VALUES(status),
          department = VALUES(department),
          location = VALUES(location),
          type = VALUES(type),
          required_skills = VALUES(required_skills),
          minimum_education = VALUES(minimum_education),
          minimum_experience_years = VALUES(minimum_experience_years),
          salary_min = VALUES(salary_min),
          salary_max = VALUES(salary_max)
      `,
      [
        String(seed.title).trim(),
        String(seed.description).trim(),
        String(seed.status || "active").toLowerCase() === "closed" ? "closed" : "active",
        seed.department || "Information Technology",
        seed.location || "Manila, Philippines",
        seed.type || "Full-time",
        seed.requiredSkills || null,
        seed.minimumEducation || null,
        Number(seed.minimumExperienceYears || 0),
        seed.salaryMin ?? null,
        seed.salaryMax ?? null
      ]
    );
  }
};

const analyzeResumeData = async (filePath, mimeType, appliedJobTitle = "") => {
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
  const jobs = await getJobsFromDb();
  const normalizedAppliedJobTitle = String(appliedJobTitle || "").trim();
  const selectedJobs = normalizedAppliedJobTitle
    ? jobs.filter((job) => String(job.title || "").toLowerCase() === normalizedAppliedJobTitle.toLowerCase())
    : jobs;

  if (!selectedJobs.length) {
    const error = new Error("Selected job post was not found.");
    error.statusCode = 400;
    throw error;
  }

  const matchResults = await matchJobs(cvText, selectedJobs);
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
    appliedJobTitle: normalizedAppliedJobTitle || matchedJobTitle || null,
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

// Job postings route sourced from MySQL jobs table.
app.get("/jobs", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT COALESCE(applied_job_title, matched_job_title) AS job_title, COUNT(*) AS applicants
        FROM uploads
        WHERE COALESCE(applied_job_title, matched_job_title) IS NOT NULL
          AND COALESCE(applied_job_title, matched_job_title) <> ''
        GROUP BY COALESCE(applied_job_title, matched_job_title)
      `
    );

    const countsByTitle = rows.reduce((acc, row) => {
      acc[row.job_title] = Number(row.applicants) || 0;
      return acc;
    }, {});

    const jobs = await getJobsFromDb();
    const payload = jobs.map((job) => ({
      id: job.id,
      title: job.title,
      description: job.description,
      status: job.status || "active",
      department: job.department || "Information Technology",
      location: job.location || "Manila, Philippines",
      type: job.type || "Full-time",
      requiredSkills: job.requiredSkills || "",
      minimumEducation: job.minimumEducation || "",
      minimumExperienceYears: Number(job.minimumExperienceYears || 0),
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      applicants: countsByTitle[job.title] || 0
    }));

    res.json(payload);
  } catch (error) {
    console.error("Fetch jobs error:", error);
    res.status(500).json({ message: "Failed to fetch jobs." });
  }
});

app.put("/jobs/:id/status", async (req, res) => {
  const { id } = req.params;
  const status = String(req.body?.status || "").toLowerCase();

  if (!["active", "closed"].includes(status)) {
    return res.status(400).json({ message: "Status must be active or closed." });
  }

  try {
    const [result] = await pool.execute(
      "UPDATE jobs SET status = ? WHERE id = ?",
      [status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Job post not found." });
    }
    const [rows] = await pool.execute(
      `
        SELECT
          id, title, description, status, department, location, type,
          required_skills AS requiredSkills,
          minimum_education AS minimumEducation,
          minimum_experience_years AS minimumExperienceYears,
          salary_min AS salaryMin,
          salary_max AS salaryMax
        FROM jobs
        WHERE id = ?
      `,
      [id]
    );
    res.json({ message: "Job status updated.", job: rows[0] });
  } catch (error) {
    console.error("Update job status error:", error);
    res.status(500).json({ message: "Failed to update job status." });
  }
});

app.post("/jobs", async (req, res) => {
  const {
    title = "",
    description = "",
    status = "",
    department = "",
    location = "",
    type = "",
    requiredSkills = "",
    minimumEducation = "",
    minimumExperienceYears = "",
    salaryMin = "",
    salaryMax = ""
  } = req.body || {};

  const normalizedTitle = String(title).trim();
  const normalizedDescription = String(description).trim();
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedDepartment = String(department || "").trim();
  const normalizedLocation = String(location || "").trim();
  const normalizedType = String(type || "").trim();
  const normalizedRequiredSkills = String(requiredSkills || "").trim();
  const normalizedMinimumEducation = String(minimumEducation || "").trim();
  const normalizedMinimumExperienceYears = Number(minimumExperienceYears);
  const normalizedSalaryMin = salaryMin === null || salaryMin === "" ? NaN : Number(salaryMin);
  const normalizedSalaryMax = salaryMax === null || salaryMax === "" ? NaN : Number(salaryMax);

  const hasMissingField = (
    !normalizedTitle ||
    !normalizedDescription ||
    !normalizedDepartment ||
    !normalizedLocation ||
    !normalizedType ||
    !normalizedRequiredSkills ||
    !normalizedMinimumEducation ||
    Number.isNaN(normalizedMinimumExperienceYears) ||
    Number.isNaN(normalizedSalaryMin) ||
    Number.isNaN(normalizedSalaryMax)
  );

  if (hasMissingField) {
    return res.status(400).json({ message: "All job post fields are required." });
  }

  if (!["active", "closed"].includes(normalizedStatus)) {
    return res.status(400).json({ message: "Status must be active or closed." });
  }

  if (normalizedMinimumExperienceYears < 0) {
    return res.status(400).json({ message: "Minimum experience must be non-negative." });
  }

  if (normalizedSalaryMin < 0 || normalizedSalaryMax < 0) {
    return res.status(400).json({ message: "Salary range must be non-negative." });
  }

  if (normalizedSalaryMax < normalizedSalaryMin) {
    return res.status(400).json({ message: "Salary max must be greater than or equal to salary min." });
  }

  try {
    const [duplicateRows] = await pool.execute(
      "SELECT id FROM jobs WHERE LOWER(title) = LOWER(?) LIMIT 1",
      [normalizedTitle]
    );
    if (duplicateRows.length) {
      return res.status(409).json({ message: "A job post with this title already exists." });
    }
    const [insertResult] = await pool.execute(
      `
        INSERT INTO jobs (
          title, description, status, department, location, type,
          required_skills, minimum_education, minimum_experience_years, salary_min, salary_max
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        normalizedTitle,
        normalizedDescription,
        normalizedStatus,
        normalizedDepartment,
        normalizedLocation,
        normalizedType,
        normalizedRequiredSkills,
        normalizedMinimumEducation,
        normalizedMinimumExperienceYears,
        normalizedSalaryMin,
        normalizedSalaryMax
      ]
    );
    const [rows] = await pool.execute(
      `
        SELECT
          id, title, description, status, department, location, type,
          required_skills AS requiredSkills,
          minimum_education AS minimumEducation,
          minimum_experience_years AS minimumExperienceYears,
          salary_min AS salaryMin,
          salary_max AS salaryMax
        FROM jobs
        WHERE id = ?
      `,
      [insertResult.insertId]
    );
    res.status(201).json({ message: "Job post created.", job: rows[0] });
  } catch (error) {
    console.error("Create job post error:", error);
    res.status(500).json({ message: "Failed to create job post." });
  }
});

app.delete("/jobs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute("DELETE FROM jobs WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Job post not found." });
    }
    res.json({ message: "Job post deleted." });
  } catch (error) {
    console.error("Delete job post error:", error);
    res.status(500).json({ message: "Failed to delete job post." });
  }
});

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const { name = "", email = "", phone = "", appliedJobTitle = "" } = req.body;
  if (!name.trim() || !email.trim() || !phone.trim() || !String(appliedJobTitle).trim()) {
    return res.status(400).json({ message: "Name, email, phone, and job post are required." });
  }

  const [selectedJobRows] = await pool.execute(
    "SELECT id, title, status FROM jobs WHERE LOWER(title) = LOWER(?) LIMIT 1",
    [String(appliedJobTitle).trim()]
  );
  const selectedJob = selectedJobRows[0];

  if (!selectedJobRows.length) {
    return res.status(400).json({ message: "Selected job post was not found." });
  }

  if (String(selectedJob.status || "active").toLowerCase() !== "active") {
    return res.status(400).json({ message: "Selected job post is closed." });
  }

  try {
    const { originalname, filename, path: savedPath, mimetype, size } = req.file;
    const {
      extractedTextForStorage,
      appliedJobTitle: normalizedAppliedJobTitle,
      matchedJobTitle,
      matchScore,
      projectScore,
      classification,
      matchedSkills,
      missingSkills
    } = await analyzeResumeData(savedPath, mimetype, appliedJobTitle);

    const [result] = await pool.execute(
      `
        INSERT INTO uploads (
          name, email, phone, applied_job_title, matched_job_title, match_score, project_score, classification, matched_skills, extracted_text, missing_skills,
          original_name, saved_name, file_path, mime_type, size_bytes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name.trim(),
        email.trim(),
        phone.trim(),
        normalizedAppliedJobTitle,
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
        appliedJobTitle: normalizedAppliedJobTitle,
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
      "SELECT id, name, email, phone, applied_job_title, original_name, saved_name, file_path, mime_type, size_bytes, uploaded_at FROM uploads WHERE id = ?",
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

    const requestedAppliedJobTitle = String(req.body?.appliedJobTitle || current.applied_job_title || "").trim();

    const {
      extractedTextForStorage,
      appliedJobTitle: normalizedAppliedJobTitle,
      matchedJobTitle,
      matchScore,
      projectScore,
      classification,
      matchedSkills,
      missingSkills
    } = await analyzeResumeData(filePath, mimeType, requestedAppliedJobTitle);

    await pool.execute(
      `
        UPDATE uploads
        SET original_name = ?, saved_name = ?, file_path = ?, mime_type = ?, size_bytes = ?,
            applied_job_title = ?, matched_job_title = ?, match_score = ?, project_score = ?, classification = ?, matched_skills = ?, extracted_text = ?, missing_skills = ?
        WHERE id = ?
      `,
      [
        originalName,
        savedName,
        filePath,
        mimeType,
        sizeBytes,
        normalizedAppliedJobTitle,
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
      "SELECT id, name, email, phone, applied_job_title, matched_job_title, match_score, project_score, classification, matched_skills, extracted_text, missing_skills, original_name, saved_name, file_path, mime_type, size_bytes, uploaded_at FROM uploads WHERE id = ?",
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
      "SELECT id, name, email, phone, applied_job_title, matched_job_title, match_score, project_score, classification, matched_skills, extracted_text, missing_skills, original_name, saved_name, file_path, mime_type, size_bytes, uploaded_at FROM uploads ORDER BY uploaded_at DESC"
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
