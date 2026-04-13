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
const { initDb } = require("./db/initDb");

// Environment configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const jobsSeedPath = path.join(__dirname, "jobs.json");
const skillsCatalogPath = path.join(__dirname, "skills.json");
const MIN_MATCH_SCORE = 50;

app.use(cors());
app.use(express.json());

app.use('/api', matchRoute);

// Local uploads directory setup
const uploadsDir = path.join(__dirname, "uploads");
const supportingDir = path.join(uploadsDir, "supporting");
const resumesDir = path.join(uploadsDir, "resumes");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(supportingDir)) {
  fs.mkdirSync(supportingDir, { recursive: true });
}
if (!fs.existsSync(resumesDir)) {
  fs.mkdirSync(resumesDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "supportingFiles") {
      return cb(null, supportingDir);
    }
    return cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});

const upload = multer({ storage });
const uploadFields = multer({ storage }).fields([
  { name: "file", maxCount: 1 },
  { name: "supportingFiles", maxCount: 10 }
]);

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, resumesDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});

const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 6 * 1024 * 1024 }
});

const supportingUpload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 }
}).fields([
  { name: "supportingFiles", maxCount: 10 }
]);

const resumeMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg"
]);

const supportingMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg"
]);

const normalizePhilippinePhone = (value) => {
  const digitsOnly = String(value || "").replace(/\D/g, "");
  if (!digitsOnly) return null;

  let local = digitsOnly;
  if (local.startsWith("63")) {
    local = local.slice(2);
  }
  if (local.startsWith("0")) {
    local = local.slice(1);
  }

  if (!/^\d{10}$/.test(local)) {
    return null;
  }

  return `+63${local}`;
};

const isStrongPassword = (value) => {
  const password = String(value || "");
  if (password.length < 8 || password.length > 12) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSymbol;
};

const verifyRecaptchaToken = async (token, remoteIp) => {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) {
    const error = new Error("reCAPTCHA secret is not configured.");
    error.statusCode = 500;
    throw error;
  }
  const params = new URLSearchParams({
    secret,
    response: token
  });
  if (remoteIp) {
    params.append("remoteip", remoteIp);
  }
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });
  const data = await response.json();
  return data;
};

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

const normalizeJobTitleKey = (value) =>
  String(value || "").trim().toLowerCase();

const readSkillsCatalog = () => {
  try {
    const raw = fs.readFileSync(skillsCatalogPath, "utf-8");
    const parsed = JSON.parse(raw);
    const jobs = parsed?.jobs && typeof parsed.jobs === "object" ? parsed.jobs : {};
    return jobs;
  } catch (error) {
    console.error("Read skills catalog error:", error);
    return {};
  }
};

const parseSkills = (value) =>
  String(value || "")
    .split(/[,;\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const syncJobSkillCatalog = async (jobId, requiredSkills) => {
  const skills = Array.from(new Set(parseSkills(requiredSkills)));
  await pool.execute("DELETE FROM job_skill_catalog WHERE job_id = ?", [jobId]);
  if (!skills.length) return;
  const rows = skills.map((skill) => [jobId, skill]);
  await pool.query(
    "INSERT INTO job_skill_catalog (job_id, skill) VALUES ?",
    [rows]
  );
  await upsertGlobalSkills(skills);
};

const upsertGlobalSkills = async (skills = []) => {
  const unique = Array.from(new Set(skills.map((skill) => String(skill || "").trim()).filter(Boolean)));
  if (!unique.length) return;
  const rows = unique.map((skill) => [skill]);
  await pool.query(
    "INSERT IGNORE INTO global_skill_catalog (skill) VALUES ?",
    [rows]
  );
};

const toSeedJob = (seed) => ({
  id: null,
  templateId: Number(seed.id) || null,
  source: "template",
  title: String(seed.title || "").trim(),
  description: String(seed.description || "").trim(),
  status: String(seed.status || "active").toLowerCase() === "closed" ? "closed" : "active",
  department: seed.department || "Information Technology",
  location: seed.location || "Manila, Philippines",
  type: seed.type || "Full-time",
  requiredSkills: seed.requiredSkills || "",
  minimumEducation: seed.minimumEducation || "",
  minimumExperienceYears: Number(seed.minimumExperienceYears || 0),
  salaryMin: seed.salaryMin ?? null,
  salaryMax: seed.salaryMax ?? null
});

const mergeJobsSeedWithDb = async () => {
  const seedJobs = readJobsSeed().filter((job) => job?.title && job?.description);
  const dbJobs = await getJobsFromDb();

  const dbByTitle = new Map(
    dbJobs.map((job) => [normalizeJobTitleKey(job.title), job])
  );

  const merged = [];
  for (const seed of seedJobs) {
    const normalizedTitle = normalizeJobTitleKey(seed.title);
    const dbJob = dbByTitle.get(normalizedTitle);
    if (!dbJob) {
      merged.push(toSeedJob(seed));
      continue;
    }
    // DB wins when there is a matching title.
    merged.push({
      ...dbJob,
      source: "db",
      requiredSkills: dbJob.requiredSkills || "",
      minimumEducation: dbJob.minimumEducation || "",
      minimumExperienceYears: Number(dbJob.minimumExperienceYears || 0),
      salaryMin: dbJob.salaryMin ?? null,
      salaryMax: dbJob.salaryMax ?? null
    });
    dbByTitle.delete(normalizedTitle);
  }

  // Include DB-only jobs not present in jobs.json.
  for (const dbJob of dbByTitle.values()) {
    merged.push({
      ...dbJob,
      source: "db",
      requiredSkills: dbJob.requiredSkills || "",
      minimumEducation: dbJob.minimumEducation || "",
      minimumExperienceYears: Number(dbJob.minimumExperienceYears || 0),
      salaryMin: dbJob.salaryMin ?? null,
      salaryMax: dbJob.salaryMax ?? null
    });
  }

  return merged;
};

// MySQL connection pool (initialized after ensuring the database exists)
let pool;

const ensureDatabaseExists = async () => {
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "capstone_db";

  const adminConn = await mysql.createConnection({ host, port, user, password });
  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await adminConn.end();

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10
  });
};

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


const extractTextForFile = async (file) => {
  const mimeType = file?.mimetype;
  const filePath = file?.path;
  if (!filePath || !mimeType) return "";
  try {
    if (mimeType === "application/pdf") {
      return (await extractTextFromPdf(filePath)) || "";
    }
    if (mimeType.startsWith("image/")) {
      return (await extractTextFromImage(filePath)) || "";
    }
  } catch (error) {
    console.warn("Supporting doc extract failed:", filePath, error.message || error);
  }
  return "";
};

const getSupportingDocKeywords = (type) => {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === "certificate") {
    return ["certificate", "certification", "certified", "license", "licence"];
  }
  if (normalized === "portfolio") {
    return ["portfolio", "project", "work samples", "case study", "showcase"];
  }
  if (normalized === "recommendation" || normalized === "application-letter") {
    return ["application letter", "cover letter", "recommendation", "reference", "endorsement"];
  }
  if (normalized === "transcript") {
    return ["transcript", "grade", "gpa", "records", "academic"];
  }
  return [];
};

const normalizeSupportingType = (type) => {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === "certificate") return "certificate";
  if (normalized === "portfolio") return "portfolio";
  if (normalized === "recommendation" || normalized === "application-letter") return "recommendation";
  if (normalized === "transcript") return "transcript";
  if (normalized === "other" || normalized === "others") return "others";
  return "others";
};

const validateSupportingFiles = async (files = [], types = []) => {
  const invalid = [];
  const texts = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const type = types[i] || "other";
    const keywords = getSupportingDocKeywords(type);
    const text = await extractTextForFile(file);
    if (text) texts.push(text);

    if (!keywords.length) continue;

    const haystack = `${file?.originalname || ""}\n${text}`.toLowerCase();
    const matched = keywords.some((word) => haystack.includes(word));
    if (!matched) {
      invalid.push({ type, name: file?.originalname || "document" });
    }
  }

  return { invalid, supportingText: texts.join("\n") };
};

const analyzeResumeData = async (filePath, mimeType, appliedJobTitle = "", supportingText = "") => {
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
  const supportingCombined = String(supportingText || "").replace(/\s+/g, " ").trim().slice(0, 4000);
  const combinedText = supportingCombined ? `${cvText}\n${supportingCombined}` : cvText;
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

  const baseResults = await matchJobs(cvText, selectedJobs);
  const combinedResults = supportingCombined ? await matchJobs(combinedText, selectedJobs) : baseResults;
  const topMatch = combinedResults?.[0] || null;
  const baseByTitle = new Map(
    baseResults.map((item) => [String(item.title || "").toLowerCase(), Number(item.score || 0)])
  );
  const normalizedTopTitle = String(topMatch?.title || "").toLowerCase();
  const baseScoreForTop = baseByTitle.get(normalizedTopTitle) ?? Number(topMatch?.score || 0);
  const combinedScore = Number(topMatch?.score || 0);
  const bonus = Math.max(0, combinedScore - baseScoreForTop);
  const cappedBonus = Math.min(bonus, 5);
  const finalScore = Math.min(100, baseScoreForTop + cappedBonus);
  const matchedJobTitle = topMatch?.title || null;
  const matchScore = topMatch ? finalScore : null;
  const projectScore = topMatch?.projectScore ? Number(topMatch.projectScore) : null;
  let classification = "Not Qualified";
  if (matchScore != null) {
    if (matchScore >= 80) {
      classification = "Highly Qualified";
    } else if (matchScore >= 60) {
      classification = "Moderately Qualified";
    }
  }
  const topMissingSkills = Array.isArray(topMatch?.missingSkills) ? topMatch.missingSkills : [];
  const allMatchedSkills = Array.from(
    new Set(
      (combinedResults || [])
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

const resolveAndValidatePath = (targetPath, rootDir) => {
  if (!targetPath) return null;
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootDir);
  if (!resolvedTarget.startsWith(resolvedRoot)) return null;
  return resolvedTarget;
};

const safeDeleteFile = async (targetPath, rootDir) => {
  const resolvedTarget = resolveAndValidatePath(targetPath, rootDir);
  if (!resolvedTarget) return;
  try {
    await fs.promises.unlink(resolvedTarget);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("File delete error:", error);
    }
  }
};

const listJobSeekerSupportingFiles = async (seekerId) => {
  const [rows] = await pool.execute(
    `
      SELECT id, doc_type, original_name, saved_name, file_path, mime_type, size_bytes, uploaded_at
      FROM job_seeker_supporting_files
      WHERE job_seeker_id = ?
      ORDER BY uploaded_at DESC
    `,
    [seekerId]
  );
  return rows.map((row) => ({
    id: row.id,
    type: normalizeSupportingType(row.doc_type),
    originalName: row.original_name,
    savedName: row.saved_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at
  }));
};

// Health route
app.get("/api", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Verify reCAPTCHA token
app.post("/auth/verify-recaptcha", async (req, res) => {
  const { token = "" } = req.body || {};
  if (!String(token).trim()) {
    return res.status(400).json({ message: "Missing reCAPTCHA token." });
  }
  try {
    const result = await verifyRecaptchaToken(String(token).trim(), req.ip);
    if (!result?.success) {
      return res.status(400).json({ message: "reCAPTCHA verification failed.", errors: result?.["error-codes"] || [] });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("reCAPTCHA verify error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message || "reCAPTCHA verification failed." });
  }
});

// Job seeker registration
app.post("/job-seekers/register", async (req, res) => {
  const {
    fullName = "",
    username = "",
    email = "",
    phone = "",
    password = "",
    status = "active"
  } = req.body || {};

  const normalizedFullName = String(fullName).trim();
  const normalizedUsername = String(username).trim();
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPhone = String(phone).trim();
  const normalizedPassword = String(password).trim();
  const normalizedStatus = String(status || "active").trim().toLowerCase();

  if (!normalizedFullName || !normalizedUsername || !normalizedEmail || !normalizedPhone || !normalizedPassword) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (!isStrongPassword(normalizedPassword)) {
    return res.status(400).json({
      message: "Password must be 8-12 characters and include uppercase, lowercase, number, and symbol."
    });
  }

  if (!["active", "inactive"].includes(normalizedStatus)) {
    return res.status(400).json({ message: "Status must be active or inactive." });
  }

  try {
    const [existing] = await pool.execute(
      "SELECT id FROM job_seekers WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1",
      [normalizedUsername, normalizedEmail]
    );
    if (existing.length) {
      return res.status(409).json({ message: "Username or email already exists." });
    }

    const [result] = await pool.execute(
      `
        INSERT INTO job_seekers (full_name, username, email, phone, password, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        normalizedFullName,
        normalizedUsername,
        normalizedEmail,
        normalizedPhone,
        normalizedPassword,
        normalizedStatus
      ]
    );

    return res.status(201).json({ message: "Job seeker registered.", id: result.insertId });
  } catch (error) {
    console.error("Register job seeker error:", error);
    return res.status(500).json({ message: "Failed to register job seeker." });
  }
});

// Job seeker login
app.post("/job-seekers/login", async (req, res) => {
  const { identifier = "", password = "", recaptchaToken = "", recaptchaBypass = false } = req.body || {};
  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  const normalizedPassword = String(password).trim();
  const normalizedRecaptchaToken = String(recaptchaToken).trim();
  const shouldBypassRecaptcha = Boolean(recaptchaBypass);

  if (!normalizedIdentifier || !normalizedPassword) {
    return res.status(400).json({ message: "Identifier and password are required." });
  }
  if (!normalizedRecaptchaToken && !shouldBypassRecaptcha) {
    return res.status(400).json({ message: "Missing reCAPTCHA token." });
  }

  try {
    if (!shouldBypassRecaptcha) {
      const recaptchaResult = await verifyRecaptchaToken(normalizedRecaptchaToken, req.ip);
      if (!recaptchaResult?.success) {
        return res.status(400).json({ message: "reCAPTCHA verification failed." });
      }
    }
    const [rows] = await pool.execute(
      `
        SELECT id, full_name, username, email, phone, status, password, created_at
        FROM job_seekers
        WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
        LIMIT 1
      `,
      [normalizedIdentifier, normalizedIdentifier]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const seeker = rows[0];
    if (String(seeker.password) !== normalizedPassword) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    return res.json({
      id: seeker.id,
      fullName: seeker.full_name,
      username: seeker.username,
      email: seeker.email,
      phone: seeker.phone,
      status: seeker.status,
      createdAt: seeker.created_at
    });
  } catch (error) {
    console.error("Login job seeker error:", error);
    return res.status(500).json({ message: "Failed to login job seeker." });
  }
});

// List all job seekers (admin)
app.get("/job-seekers/all", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
        SELECT id, full_name, username, email, phone, status, created_at
        FROM job_seekers
        ORDER BY created_at DESC
      `
    );
    return res.json(rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      username: row.username,
      email: row.email,
      phone: row.phone,
      status: row.status,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error("List job seekers error:", error);
    return res.status(500).json({ message: "Failed to load job seekers." });
  }
});

// Admin update job seeker
app.put("/job-seekers/:id/admin", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }
  const { fullName = "", username = "", email = "", phone = "" } = req.body || {};
  const normalizedFullName = String(fullName).trim();
  const normalizedUsername = String(username).trim();
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPhone = String(phone).trim();
  if (!normalizedFullName || !normalizedUsername || !normalizedEmail || !normalizedPhone) {
    return res.status(400).json({ message: "All fields are required." });
  }
  try {
    await pool.execute(
      `
        UPDATE job_seekers
        SET full_name = ?, username = ?, email = ?, phone = ?
        WHERE id = ?
      `,
      [normalizedFullName, normalizedUsername, normalizedEmail, normalizedPhone, seekerId]
    );
    return res.json({ message: "Job seeker updated." });
  } catch (error) {
    console.error("Update job seeker error:", error);
    return res.status(500).json({ message: "Failed to update job seeker." });
  }
});

// Admin delete job seeker
app.delete("/job-seekers/:id", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }
  try {
    await pool.execute("DELETE FROM job_seekers WHERE id = ?", [seekerId]);
    return res.json({ message: "Job seeker deleted." });
  } catch (error) {
    console.error("Delete job seeker error:", error);
    return res.status(500).json({ message: "Failed to delete job seeker." });
  }
});

// List employers (admin)
app.get("/employers", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
        SELECT id, company_name, contact_name, email, phone, status, created_at
        FROM employers
        ORDER BY created_at DESC
      `
    );
    return res.json(rows.map((row) => ({
      id: row.id,
      companyName: row.company_name,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      createdAt: row.created_at
    })));
  } catch (error) {
    console.error("List employers error:", error);
    return res.status(500).json({ message: "Failed to load employers." });
  }
});

app.post("/employers", async (req, res) => {
  const { companyName = "", contactName = "", email = "", phone = "", password = "" } = req.body || {};
  const normalizedCompany = String(companyName).trim();
  const normalizedContact = String(contactName).trim();
  const normalizedEmail = String(email).trim();
  const normalizedPhone = String(phone).trim();
  const normalizedPassword = String(password).trim();
  if (!normalizedCompany || !normalizedEmail || !normalizedPassword) {
    return res.status(400).json({ message: "Company name, username, and password are required." });
  }
  if (!isStrongPassword(normalizedPassword)) {
    return res.status(400).json({
      message: "Password must be 8-12 characters and include uppercase, lowercase, number, and symbol."
    });
  }
  try {
    const [existing] = await pool.execute(
      "SELECT id FROM employers WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [normalizedEmail]
    );
    if (existing.length) {
      return res.status(409).json({ message: "Username already exists." });
    }
    const [result] = await pool.execute(
      `
        INSERT INTO employers (company_name, contact_name, email, phone, status)
        VALUES (?, ?, ?, ?, ?)
      `,
      [normalizedCompany, normalizedContact || null, normalizedEmail, normalizedPhone || null, "active"]
    );
    await pool.execute(
      "UPDATE employers SET password = ? WHERE id = ?",
      [normalizedPassword, result.insertId]
    );
    return res.status(201).json({ message: "Employer created.", id: result.insertId });
  } catch (error) {
    console.error("Create employer error:", error);
    return res.status(500).json({ message: "Failed to create employer." });
  }
});

app.post("/employers/login", async (req, res) => {
  const { identifier = "", password = "" } = req.body || {};
  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  const normalizedPassword = String(password).trim();
  if (!normalizedIdentifier || !normalizedPassword) {
    return res.status(400).json({ message: "Identifier and password are required." });
  }
  try {
    const [rows] = await pool.execute(
      `
        SELECT id, company_name, contact_name, email, phone, status, password, created_at
        FROM employers
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
      `,
      [normalizedIdentifier]
    );
    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const employer = rows[0];
    if (String(employer.password || "") !== normalizedPassword) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    return res.json({
      id: employer.id,
      companyName: employer.company_name,
      contactName: employer.contact_name,
      email: employer.email,
      phone: employer.phone,
      status: employer.status,
      createdAt: employer.created_at
    });
  } catch (error) {
    console.error("Login employer error:", error);
    return res.status(500).json({ message: "Failed to login employer." });
  }
});

app.put("/employers/:id", async (req, res) => {
  const employerId = Number(req.params.id);
  if (!Number.isInteger(employerId) || employerId <= 0) {
    return res.status(400).json({ message: "Invalid employer id." });
  }
  const { companyName = "", contactName = "", email = "", phone = "" } = req.body || {};
  const normalizedCompany = String(companyName).trim();
  const normalizedContact = String(contactName).trim();
  const normalizedEmail = String(email).trim();
  const normalizedPhone = String(phone).trim();
  if (!normalizedCompany || !normalizedEmail) {
    return res.status(400).json({ message: "Company name and username are required." });
  }
  try {
    await pool.execute(
      `
        UPDATE employers
        SET company_name = ?, contact_name = ?, email = ?, phone = ?
        WHERE id = ?
      `,
      [normalizedCompany, normalizedContact || null, normalizedEmail, normalizedPhone || null, employerId]
    );
    return res.json({ message: "Employer updated." });
  } catch (error) {
    console.error("Update employer error:", error);
    return res.status(500).json({ message: "Failed to update employer." });
  }
});

app.delete("/employers/:id", async (req, res) => {
  const employerId = Number(req.params.id);
  if (!Number.isInteger(employerId) || employerId <= 0) {
    return res.status(400).json({ message: "Invalid employer id." });
  }
  try {
    await pool.execute("DELETE FROM employers WHERE id = ?", [employerId]);
    return res.json({ message: "Employer deleted." });
  } catch (error) {
    console.error("Delete employer error:", error);
    return res.status(500).json({ message: "Failed to delete employer." });
  }
});

// Job seeker profile
app.get("/job-seekers/:id", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT id, full_name, username, email, phone, status, created_at, location, about_text, linkedin_url
        FROM job_seekers
        WHERE id = ?
        LIMIT 1
      `,
      [seekerId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Job seeker not found." });
    }

    const seeker = rows[0];
    const [education] = await pool.execute(
      `
        SELECT id, school, program, year
        FROM job_seeker_education
        WHERE job_seeker_id = ?
        ORDER BY id DESC
      `,
      [seekerId]
    );
    const [experience] = await pool.execute(
      `
        SELECT id, title, company, year
        FROM job_seeker_experience
        WHERE job_seeker_id = ?
        ORDER BY id DESC
      `,
      [seekerId]
    );
    return res.json({
      id: seeker.id,
      fullName: seeker.full_name,
      username: seeker.username,
      email: seeker.email,
      phone: seeker.phone,
      status: seeker.status,
      address: seeker.location,
      location: seeker.location,
      aboutText: seeker.about_text,
      linkedInUrl: seeker.linkedin_url,
      createdAt: seeker.created_at,
      education,
      experience
    });
  } catch (error) {
    console.error("Fetch job seeker profile error:", error);
    return res.status(500).json({ message: "Failed to fetch job seeker profile." });
  }
});

app.put("/job-seekers/:id", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }

    const {
      fullName = "",
      username = "",
      email = "",
      phone = "",
      status = "",
      address = "",
      location = "",
      aboutText = "",
      linkedInUrl = ""
    } = req.body || {};

  try {
    await pool.execute(
      `
        UPDATE job_seekers
        SET full_name = ?, username = ?, email = ?, phone = ?, status = ?, location = ?, about_text = ?, linkedin_url = ?
        WHERE id = ?
      `,
      [
        String(fullName || "").trim(),
        String(username || "").trim(),
        String(email || "").trim().toLowerCase(),
        String(phone || "").trim(),
        String(status || "").trim().toLowerCase(),
        String(address || location || "").trim(),
        String(aboutText || "").trim(),
        String(linkedInUrl || "").trim(),
        seekerId
      ]
    );

    return res.json({ message: "Profile updated." });
  } catch (error) {
    console.error("Update job seeker profile error:", error);
    return res.status(500).json({ message: "Failed to update job seeker profile." });
  }
});

// Job seeker resume upload
app.post("/job-seekers/:id/resume", (req, res) => {
  resumeUpload.single("file")(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "Resume file is too large. Max 6MB." });
      }
      console.error("Resume upload error:", err);
      return res.status(400).json({ message: "Failed to upload resume." });
    }

    const seekerId = Number(req.params.id);
    if (!Number.isInteger(seekerId) || seekerId <= 0) {
      return res.status(400).json({ message: "Invalid job seeker id." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const { originalname, filename, path: savedPath, mimetype, size } = req.file;
    if (!resumeMimeTypes.has(mimetype)) {
      return res.status(400).json({ message: "Unsupported file type. Upload PDF or image." });
    }

    try {
      const [currentRows] = await pool.execute(
        `
          SELECT resume_file_path
          FROM job_seekers
          WHERE id = ?
          LIMIT 1
        `,
        [seekerId]
      );
      const existingPath = currentRows[0]?.resume_file_path || null;

      const [result] = await pool.execute(
        `
          UPDATE job_seekers
          SET resume_name = ?, resume_original_name = ?, resume_saved_name = ?, resume_file_path = ?,
              resume_type = ?, resume_size = ?, resume_data = NULL, resume_updated_at = NOW()
          WHERE id = ?
        `,
        [originalname, originalname, filename, savedPath, mimetype, size, seekerId]
      );

      if (!result.affectedRows) {
        return res.status(404).json({ message: "Job seeker not found." });
      }

      if (existingPath) {
        const resolvedOld = path.resolve(existingPath);
        const resolvedRoot = path.resolve(resumesDir);
        if (resolvedOld.startsWith(resolvedRoot)) {
          try {
            await fs.promises.unlink(resolvedOld);
          } catch (unlinkError) {
            if (unlinkError.code !== "ENOENT") {
              console.error("Old resume delete error:", unlinkError);
            }
          }
        }
      }

      return res.json({
        message: "Resume uploaded.",
        resume: {
          name: originalname,
          mimeType: mimetype,
          sizeBytes: size,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Upload resume error:", error);
      if (error.code === "ECONNRESET") {
        return res.status(500).json({ message: "Database connection was reset. Try a smaller file." });
      }
      return res.status(500).json({ message: "Failed to upload resume." });
    }
  });
});

// Job seeker resume metadata
app.get("/job-seekers/:id/resume", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT resume_original_name, resume_type, resume_size, resume_updated_at
        FROM job_seekers
        WHERE id = ?
        LIMIT 1
      `,
      [seekerId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Job seeker not found." });
    }

    const resume = rows[0];
    if (!resume.resume_original_name) {
      return res.json({ resume: null });
    }

    return res.json({
      resume: {
        name: resume.resume_original_name,
        mimeType: resume.resume_type,
        sizeBytes: resume.resume_size,
        updatedAt: resume.resume_updated_at
      }
    });
  } catch (error) {
    console.error("Fetch resume metadata error:", error);
    return res.status(500).json({ message: "Failed to fetch resume." });
  }
});

// Job seeker resume match check against a specific job
app.get("/job-seekers/:id/resume/match", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }
  const jobTitle = String(req.query?.jobTitle || "").trim();
  if (!jobTitle) {
    return res.status(400).json({ message: "Job title is required." });
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT resume_file_path, resume_type
        FROM job_seekers
        WHERE id = ?
      `,
      [seekerId]
    );
    const resumeRecord = rows[0];
    if (!resumeRecord?.resume_file_path) {
      return res.status(404).json({ message: "Resume not found." });
    }

    const resolvedFilePath = resolveAndValidatePath(resumeRecord.resume_file_path, resumesDir);
    if (!resolvedFilePath || !fs.existsSync(resolvedFilePath)) {
      return res.status(404).json({ message: "Resume file is missing." });
    }

    const {
      matchedJobTitle,
      matchScore,
      classification,
      matchedSkills,
      missingSkills
    } = await analyzeResumeData(resolvedFilePath, resumeRecord.resume_type, jobTitle);

    const numericScore = Number(matchScore || 0);
    const qualifies = numericScore > MIN_MATCH_SCORE;

    return res.json({
      matchedJobTitle,
      matchScore: Number.isNaN(numericScore) ? null : numericScore,
      classification,
      matchedSkills,
      missingSkills,
      minimumScore: MIN_MATCH_SCORE,
      qualifies
    });
  } catch (error) {
    console.error("Resume match check error:", error);
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to check resume match." });
  }
});

// Job seeker resume download
app.get("/job-seekers/:id/resume/download", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT resume_original_name, resume_type, resume_file_path
        FROM job_seekers
        WHERE id = ?
        LIMIT 1
      `,
      [seekerId]
    );

    if (!rows.length || !rows[0].resume_file_path) {
      return res.status(404).json({ message: "Resume not found." });
    }

    const resume = rows[0];
    const resolvedFilePath = path.resolve(resume.resume_file_path);
    const resolvedResumesDir = path.resolve(resumesDir);
    if (!resolvedFilePath.startsWith(resolvedResumesDir)) {
      return res.status(400).json({ message: "Invalid resume path." });
    }

    res.setHeader("Content-Type", resume.resume_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${resume.resume_original_name || "resume"}"`);
    return res.sendFile(resolvedFilePath);
  } catch (error) {
    console.error("Download resume error:", error);
    return res.status(500).json({ message: "Failed to download resume." });
  }
});

// Job seeker resume delete
app.delete("/job-seekers/:id/resume", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT resume_file_path
        FROM job_seekers
        WHERE id = ?
        LIMIT 1
      `,
      [seekerId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Job seeker not found." });
    }

    const existingPath = rows[0]?.resume_file_path || null;
    const [updateResult] = await pool.execute(
      `
        UPDATE job_seekers
        SET resume_name = NULL, resume_original_name = NULL, resume_saved_name = NULL, resume_file_path = NULL,
            resume_type = NULL, resume_size = NULL, resume_data = NULL, resume_updated_at = NULL
        WHERE id = ?
      `,
      [seekerId]
    );

    if (!updateResult.affectedRows) {
      return res.status(404).json({ message: "Job seeker not found." });
    }

    if (existingPath) {
      const resolvedOld = path.resolve(existingPath);
      const resolvedRoot = path.resolve(resumesDir);
      if (resolvedOld.startsWith(resolvedRoot)) {
        try {
          await fs.promises.unlink(resolvedOld);
        } catch (unlinkError) {
          if (unlinkError.code !== "ENOENT") {
            console.error("Resume delete error:", unlinkError);
          }
        }
      }
    }

    return res.json({ message: "Resume removed." });
  } catch (error) {
    console.error("Delete resume error:", error);
    return res.status(500).json({ message: "Failed to remove resume." });
  }
});

// Job seeker supporting documents
app.get("/job-seekers/:id/supporting", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }

  try {
    const [seekerRows] = await pool.execute(
      "SELECT id FROM job_seekers WHERE id = ? LIMIT 1",
      [seekerId]
    );
    if (!seekerRows.length) {
      return res.status(404).json({ message: "Job seeker not found." });
    }

    const files = await listJobSeekerSupportingFiles(seekerId);
    return res.json({ files });
  } catch (error) {
    console.error("Fetch job seeker supporting error:", error);
    return res.status(500).json({ message: "Failed to fetch supporting documents." });
  }
});

app.post("/job-seekers/:id/supporting", (req, res) => {
  supportingUpload(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "Supporting file is too large. Max 6MB." });
      }
      console.error("Supporting upload error:", err);
      return res.status(400).json({ message: "Failed to upload supporting files." });
    }

    const seekerId = Number(req.params.id);
    if (!Number.isInteger(seekerId) || seekerId <= 0) {
      return res.status(400).json({ message: "Invalid job seeker id." });
    }

    const supportingFiles = Array.isArray(req.files?.supportingFiles) ? req.files.supportingFiles : [];
    if (!supportingFiles.length) {
      return res.status(400).json({ message: "No supporting files uploaded." });
    }

    const rawTypes = req.body?.supportingTypes;
    let supportingTypes = Array.isArray(rawTypes) ? rawTypes : (rawTypes ? [rawTypes] : []);
    if (supportingTypes.length === 1 && supportingFiles.length > 1) {
      supportingTypes = supportingFiles.map(() => supportingTypes[0]);
    }
    while (supportingTypes.length < supportingFiles.length) {
      supportingTypes.push("others");
    }
    const normalizedTypes = supportingTypes.map((type) => normalizeSupportingType(type));

    const cleanupUploadedFiles = async () => {
      await Promise.all(
        supportingFiles.map((file) => safeDeleteFile(file?.path, supportingDir))
      );
    };

    try {
      const [seekerRows] = await pool.execute(
        "SELECT id FROM job_seekers WHERE id = ? LIMIT 1",
        [seekerId]
      );
      if (!seekerRows.length) {
        await cleanupUploadedFiles();
        return res.status(404).json({ message: "Job seeker not found." });
      }

      const hasUnsupported = supportingFiles.some((file) => !supportingMimeTypes.has(file?.mimetype));
      if (hasUnsupported) {
        await cleanupUploadedFiles();
        return res.status(400).json({ message: "Unsupported file type. Upload PDF, PNG, or JPG." });
      }

      const nonOtherDuplicates = normalizedTypes
        .filter((type) => type !== "others")
        .some((type, index, arr) => arr.indexOf(type) !== index);
      if (nonOtherDuplicates) {
        await cleanupUploadedFiles();
        return res.status(400).json({ message: "Only one file per required supporting document type is allowed." });
      }

      const { invalid } = await validateSupportingFiles(supportingFiles, normalizedTypes);
      if (invalid.length) {
        await cleanupUploadedFiles();
        return res.status(400).json({
          message: "One or more supporting documents do not match the required type.",
          invalidSupporting: invalid
        });
      }

      const replaceTypes = Array.from(new Set(normalizedTypes.filter((type) => type !== "others")));
      for (const type of replaceTypes) {
        const [existingRows] = await pool.execute(
          `
            SELECT id, file_path
            FROM job_seeker_supporting_files
            WHERE job_seeker_id = ? AND doc_type = ?
          `,
          [seekerId, type]
        );
        if (existingRows.length) {
          await pool.execute(
            "DELETE FROM job_seeker_supporting_files WHERE job_seeker_id = ? AND doc_type = ?",
            [seekerId, type]
          );
          await Promise.all(
            existingRows.map((row) => safeDeleteFile(row?.file_path, supportingDir))
          );
        }
      }

      const rows = supportingFiles.map((file, index) => ([
        seekerId,
        normalizedTypes[index] || "others",
        file.originalname,
        file.filename,
        file.path,
        file.mimetype,
        file.size
      ]));

      await pool.query(
        `
          INSERT INTO job_seeker_supporting_files (
            job_seeker_id, doc_type, original_name, saved_name, file_path, mime_type, size_bytes
          )
          VALUES ?
        `,
        [rows]
      );

      const files = await listJobSeekerSupportingFiles(seekerId);
      return res.status(201).json({ message: "Supporting documents uploaded.", files });
    } catch (error) {
      await cleanupUploadedFiles();
      console.error("Upload job seeker supporting error:", error);
      return res.status(500).json({ message: "Failed to upload supporting documents." });
    }
  });
});

app.get("/job-seekers/:id/supporting/:supportId/download", async (req, res) => {
  const seekerId = Number(req.params.id);
  const supportId = Number(req.params.supportId);
  if (!Number.isInteger(seekerId) || seekerId <= 0 || !Number.isInteger(supportId) || supportId <= 0) {
    return res.status(400).json({ message: "Invalid parameters." });
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT original_name, mime_type, file_path
        FROM job_seeker_supporting_files
        WHERE id = ? AND job_seeker_id = ?
        LIMIT 1
      `,
      [supportId, seekerId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Supporting file not found." });
    }

    const fileRecord = rows[0];
    const resolvedFilePath = resolveAndValidatePath(fileRecord.file_path, supportingDir);
    if (!resolvedFilePath || !fs.existsSync(resolvedFilePath)) {
      return res.status(404).json({ message: "Supporting file is missing." });
    }

    res.setHeader("Content-Type", fileRecord.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${fileRecord.original_name || "supporting-file"}"`);
    return res.sendFile(resolvedFilePath);
  } catch (error) {
    console.error("Download job seeker supporting error:", error);
    return res.status(500).json({ message: "Failed to download supporting file." });
  }
});

app.delete("/job-seekers/:id/supporting/:supportId", async (req, res) => {
  const seekerId = Number(req.params.id);
  const supportId = Number(req.params.supportId);
  if (!Number.isInteger(seekerId) || seekerId <= 0 || !Number.isInteger(supportId) || supportId <= 0) {
    return res.status(400).json({ message: "Invalid parameters." });
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT id, file_path
        FROM job_seeker_supporting_files
        WHERE id = ? AND job_seeker_id = ?
        LIMIT 1
      `,
      [supportId, seekerId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Supporting file not found." });
    }

    await pool.execute(
      "DELETE FROM job_seeker_supporting_files WHERE id = ? AND job_seeker_id = ?",
      [supportId, seekerId]
    );
    await safeDeleteFile(rows[0]?.file_path, supportingDir);
    const files = await listJobSeekerSupportingFiles(seekerId);
    return res.json({ message: "Supporting file removed.", files });
  } catch (error) {
    console.error("Delete job seeker supporting error:", error);
    return res.status(500).json({ message: "Failed to remove supporting file." });
  }
});

app.post("/job-seekers/:id/education", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }
  const { school = "", program = "", year = "" } = req.body || {};
  if (!String(school).trim()) {
    return res.status(400).json({ message: "School is required." });
  }

  try {
    const [result] = await pool.execute(
      `
        INSERT INTO job_seeker_education (job_seeker_id, school, program, year)
        VALUES (?, ?, ?, ?)
      `,
      [seekerId, String(school).trim(), String(program).trim(), String(year).trim()]
    );
    return res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error("Add education error:", error);
    return res.status(500).json({ message: "Failed to add education." });
  }
});

app.put("/job-seekers/:id/education/:educationId", async (req, res) => {
  const seekerId = Number(req.params.id);
  const educationId = Number(req.params.educationId);
  if (!Number.isInteger(seekerId) || seekerId <= 0 || !Number.isInteger(educationId) || educationId <= 0) {
    return res.status(400).json({ message: "Invalid id." });
  }
  const { school = "", program = "", year = "" } = req.body || {};
  if (!String(school).trim()) {
    return res.status(400).json({ message: "School is required." });
  }

  try {
    await pool.execute(
      `
        UPDATE job_seeker_education
        SET school = ?, program = ?, year = ?
        WHERE id = ? AND job_seeker_id = ?
      `,
      [String(school).trim(), String(program).trim(), String(year).trim(), educationId, seekerId]
    );
    return res.json({ message: "Education updated." });
  } catch (error) {
    console.error("Update education error:", error);
    return res.status(500).json({ message: "Failed to update education." });
  }
});

app.delete("/job-seekers/:id/education/:educationId", async (req, res) => {
  const seekerId = Number(req.params.id);
  const educationId = Number(req.params.educationId);
  if (!Number.isInteger(seekerId) || seekerId <= 0 || !Number.isInteger(educationId) || educationId <= 0) {
    return res.status(400).json({ message: "Invalid id." });
  }

  try {
    await pool.execute(
      "DELETE FROM job_seeker_education WHERE id = ? AND job_seeker_id = ?",
      [educationId, seekerId]
    );
    return res.json({ message: "Education deleted." });
  } catch (error) {
    console.error("Delete education error:", error);
    return res.status(500).json({ message: "Failed to delete education." });
  }
});

app.post("/job-seekers/:id/experience", async (req, res) => {
  const seekerId = Number(req.params.id);
  if (!Number.isInteger(seekerId) || seekerId <= 0) {
    return res.status(400).json({ message: "Invalid job seeker id." });
  }
  const { title = "", company = "", year = "" } = req.body || {};
  if (!String(title).trim()) {
    return res.status(400).json({ message: "Title is required." });
  }

  try {
    const [result] = await pool.execute(
      `
        INSERT INTO job_seeker_experience (job_seeker_id, title, company, year)
        VALUES (?, ?, ?, ?)
      `,
      [seekerId, String(title).trim(), String(company).trim(), String(year).trim()]
    );
    return res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error("Add experience error:", error);
    return res.status(500).json({ message: "Failed to add experience." });
  }
});

app.put("/job-seekers/:id/experience/:experienceId", async (req, res) => {
  const seekerId = Number(req.params.id);
  const experienceId = Number(req.params.experienceId);
  if (!Number.isInteger(seekerId) || seekerId <= 0 || !Number.isInteger(experienceId) || experienceId <= 0) {
    return res.status(400).json({ message: "Invalid id." });
  }
  const { title = "", company = "", year = "" } = req.body || {};
  if (!String(title).trim()) {
    return res.status(400).json({ message: "Title is required." });
  }

  try {
    await pool.execute(
      `
        UPDATE job_seeker_experience
        SET title = ?, company = ?, year = ?
        WHERE id = ? AND job_seeker_id = ?
      `,
      [String(title).trim(), String(company).trim(), String(year).trim(), experienceId, seekerId]
    );
    return res.json({ message: "Experience updated." });
  } catch (error) {
    console.error("Update experience error:", error);
    return res.status(500).json({ message: "Failed to update experience." });
  }
});

app.delete("/job-seekers/:id/experience/:experienceId", async (req, res) => {
  const seekerId = Number(req.params.id);
  const experienceId = Number(req.params.experienceId);
  if (!Number.isInteger(seekerId) || seekerId <= 0 || !Number.isInteger(experienceId) || experienceId <= 0) {
    return res.status(400).json({ message: "Invalid id." });
  }

  try {
    await pool.execute(
      "DELETE FROM job_seeker_experience WHERE id = ? AND job_seeker_id = ?",
      [experienceId, seekerId]
    );
    return res.json({ message: "Experience deleted." });
  } catch (error) {
    console.error("Delete experience error:", error);
    return res.status(500).json({ message: "Failed to delete experience." });
  }
});

// Job template route sourced from jobs.json.
app.get("/job-templates", async (req, res) => {
  try {
    const templates = readJobsSeed().map((seed) => ({
      id: Number(seed.id) || null,
      title: String(seed.title || "").trim(),
      description: String(seed.description || "").trim(),
      department: seed.department || "Information Technology",
      location: seed.location || "Manila, Philippines",
      type: seed.type || "Full-time",
      requiredSkills: seed.requiredSkills || "",
      minimumEducation: seed.minimumEducation || "",
      minimumExperienceYears: Number(seed.minimumExperienceYears || 0),
      salaryMin: seed.salaryMin ?? null,
      salaryMax: seed.salaryMax ?? null
    }));
    res.json(templates);
  } catch (error) {
    console.error("Fetch job templates error:", error);
    res.status(500).json({ message: "Failed to fetch job templates." });
  }
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
      id: job.id ?? null,
      templateId: null,
      source: "db",
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

app.get("/jobs/:id/skills", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      "SELECT skill FROM job_skill_catalog WHERE job_id = ? ORDER BY skill ASC",
      [id]
    );
    return res.json({ skills: rows.map((row) => row.skill) });
  } catch (error) {
    console.error("Fetch job skills error:", error);
    return res.status(500).json({ message: "Failed to fetch job skills." });
  }
});

app.get("/skills", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT skill FROM global_skill_catalog ORDER BY skill ASC"
    );
    return res.json({ skills: rows.map((row) => row.skill) });
  } catch (error) {
    console.error("Fetch global skills error:", error);
    return res.status(500).json({ message: "Failed to fetch skills." });
  }
});

app.get("/skills/catalog", (req, res) => {
  const title = String(req.query?.title || "").trim();
  if (!title) {
    return res.status(400).json({ message: "Job title is required." });
  }
  const catalog = readSkillsCatalog();
  const normalizedTitle = normalizeJobTitleKey(title);
  const matchKey = Object.keys(catalog).find(
    (key) => normalizeJobTitleKey(key) === normalizedTitle
  );
  let skills = matchKey ? catalog[matchKey] : [];
  if (!skills.length && /instructor/i.test(title)) {
    const instructorKey = Object.keys(catalog).find(
      (key) => normalizeJobTitleKey(key) === "instructor"
    );
    if (instructorKey) {
      skills = catalog[instructorKey];
    }
  }
  return res.json({ skills: Array.isArray(skills) ? skills : [] });
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

app.put("/jobs/:id", async (req, res) => {
  const { id } = req.params;
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
      "SELECT id FROM jobs WHERE LOWER(title) = LOWER(?) AND id <> ? LIMIT 1",
      [normalizedTitle, id]
    );
    if (duplicateRows.length) {
      return res.status(409).json({ message: "A job post with this title already exists." });
    }

    const [result] = await pool.execute(
      `
        UPDATE jobs
        SET title = ?, description = ?, status = ?, department = ?, location = ?, type = ?,
            required_skills = ?, minimum_education = ?, minimum_experience_years = ?,
            salary_min = ?, salary_max = ?
        WHERE id = ?
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
        normalizedSalaryMax,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Job post not found." });
    }

    await syncJobSkillCatalog(id, normalizedRequiredSkills);

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
    res.json({ message: "Job post updated.", job: rows[0] });
  } catch (error) {
    console.error("Update job post error:", error);
    res.status(500).json({ message: "Failed to update job post." });
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
    await syncJobSkillCatalog(insertResult.insertId, normalizedRequiredSkills);
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
app.post("/upload", uploadFields, async (req, res) => {
  const mainFile = req.files?.file?.[0] || null;
  const supportingFiles = Array.isArray(req.files?.supportingFiles) ? req.files.supportingFiles : [];
  if (!mainFile) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const { name = "", email = "", phone = "", appliedJobTitle = "" } = req.body;
  if (!name.trim() || !email.trim() || !phone.trim() || !String(appliedJobTitle).trim()) {
    return res.status(400).json({ message: "Name, email, phone, and job post are required." });
  }
  const normalizedPhone = normalizePhilippinePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: "Phone must start with +63 and contain exactly 10 digits after it." });
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
    const { originalname, filename, path: savedPath, mimetype, size } = mainFile;
    const supportingTypesRaw = req.body?.supportingTypes;
    const supportingTypes = Array.isArray(supportingTypesRaw)
      ? supportingTypesRaw
      : (supportingTypesRaw ? [supportingTypesRaw] : []);
    const normalizedSupportingTypes = supportingTypes.map((type) => normalizeSupportingType(type));
    while (normalizedSupportingTypes.length < supportingFiles.length) {
      normalizedSupportingTypes.push("others");
    }
    const { invalid, supportingText } = await validateSupportingFiles(supportingFiles, normalizedSupportingTypes);
    if (invalid.length) {
      await safeDeleteFile(savedPath, uploadsDir);
      await Promise.all(
        supportingFiles.map((file) => safeDeleteFile(file?.path, supportingDir))
      );
      return res.status(400).json({
        message: "One or more supporting documents do not match the required type.",
        invalidSupporting: invalid
      });
    }
    const {
      extractedTextForStorage,
      appliedJobTitle: normalizedAppliedJobTitle,
      matchedJobTitle,
      matchScore,
      projectScore,
      classification,
      matchedSkills,
      missingSkills
    } = await analyzeResumeData(savedPath, mimetype, appliedJobTitle, supportingText);

    const numericScore = Number(matchScore || 0);
    if (Number.isNaN(numericScore) || numericScore <= MIN_MATCH_SCORE) {
      await safeDeleteFile(savedPath, uploadsDir);
      await Promise.all(
        supportingFiles.map((file) => safeDeleteFile(file?.path, supportingDir))
      );
      return res.status(400).json({
        message: `Resume match score ${Number.isNaN(numericScore) ? "0" : numericScore.toFixed(2)}% is below the required ${MIN_MATCH_SCORE}%.`
      });
    }

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
        normalizedPhone,
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

    if (supportingFiles.length) {
      const supportingRows = supportingFiles.map((file, index) => ([
        result.insertId,
        normalizedSupportingTypes[index] || "others",
        file.originalname,
        file.filename,
        file.path,
        file.mimetype,
        file.size
      ]));

      await pool.query(
        `
          INSERT INTO upload_supporting_files (
            upload_id, doc_type, original_name, saved_name, file_path, mime_type, size_bytes
          )
          VALUES ?
        `,
        [supportingRows]
      );
    }

    res.status(201).json({
      message: "Applicant analyzed and added successfully!",
      id: result.insertId,
      file: {
        name: name.trim(),
        email: email.trim(),
        phone: normalizedPhone,
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
      "SELECT id, name, email, phone, applied_job_title, matched_job_title, match_score, project_score, classification, matched_skills, extracted_text, missing_skills, job_seeker_hidden, job_seeker_hidden_at, original_name, saved_name, file_path, mime_type, size_bytes, uploaded_at FROM uploads ORDER BY uploaded_at DESC"
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

// List supporting files for an upload
app.get("/uploads/:id/supporting", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      `
        SELECT id, doc_type, original_name, saved_name, file_path, mime_type, size_bytes, uploaded_at
        FROM upload_supporting_files
        WHERE upload_id = ?
        ORDER BY uploaded_at DESC
      `,
      [id]
    );
    return res.json({ files: rows });
  } catch (error) {
    console.error("Fetch supporting files error:", error);
    return res.status(500).json({ message: "Failed to fetch supporting files." });
  }
});

// Download supporting file
app.get("/uploads/:id/supporting/:supportId/download", async (req, res) => {
  const { supportId } = req.params;
  try {
    const [rows] = await pool.execute(
      `
        SELECT original_name, file_path, mime_type
        FROM upload_supporting_files
        WHERE id = ?
        LIMIT 1
      `,
      [supportId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Supporting file not found." });
    }

    const fileRecord = rows[0];
    const resolvedFilePath = path.resolve(fileRecord.file_path);
    const resolvedSupportingDir = path.resolve(supportingDir);
    if (!resolvedFilePath.startsWith(resolvedSupportingDir)) {
      return res.status(400).json({ message: "Invalid supporting file path." });
    }

    res.setHeader("Content-Type", fileRecord.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${fileRecord.original_name || "supporting-file"}"`);
    return res.sendFile(resolvedFilePath);
  } catch (error) {
    console.error("Download supporting file error:", error);
    return res.status(500).json({ message: "Failed to download supporting file." });
  }
});

// Delete upload record route
app.delete("/uploads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute("SELECT file_path FROM uploads WHERE id = ?", [id]);
    const [supportingRows] = await pool.execute(
      "SELECT file_path FROM upload_supporting_files WHERE upload_id = ?",
      [id]
    );

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

    for (const item of supportingRows) {
      const supportPath = item.file_path;
      if (!supportPath) continue;
      const resolvedSupportPath = path.resolve(supportPath);
      const resolvedSupportingDir = path.resolve(supportingDir);
      if (resolvedSupportPath.startsWith(resolvedSupportingDir)) {
        try {
          await fs.promises.unlink(resolvedSupportPath);
        } catch (unlinkError) {
          if (unlinkError.code !== "ENOENT") {
            console.error("Supporting file delete error:", unlinkError);
          }
        }
      }
    }

    res.json({ message: "Upload record and file deleted." });
  } catch (error) {
    console.error("Delete upload error:", error);
    res.status(500).json({ message: "Failed to delete upload record/file." });
  }
});

// Hide upload for job seeker (soft delete)
app.put("/uploads/:id/hide", async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute(
      "UPDATE uploads SET job_seeker_hidden = 1, job_seeker_hidden_at = NOW() WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Upload not found." });
    }
    return res.json({ message: "Application hidden for job seeker." });
  } catch (error) {
    console.error("Hide upload error:", error);
    return res.status(500).json({ message: "Failed to hide application." });
  }
});

// App startup
ensureDatabaseExists()
  .then(() => initDb(pool, readJobsSeed()))
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
