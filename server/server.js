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
  const { identifier = "", password = "" } = req.body || {};
  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  const normalizedPassword = String(password).trim();

  if (!normalizedIdentifier || !normalizedPassword) {
    return res.status(400).json({ message: "Identifier and password are required." });
  }

  try {
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
        String(location || "").trim(),
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
