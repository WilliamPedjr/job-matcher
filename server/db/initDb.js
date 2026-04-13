const initDb = async (pool, seedJobs = []) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      original_name VARCHAR(255) NOT NULL,
      saved_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(100),
      size_bytes BIGINT,
      job_seeker_hidden TINYINT(1) NOT NULL DEFAULT 0,
      job_seeker_hidden_at TIMESTAMP NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS upload_supporting_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      upload_id INT NOT NULL,
      doc_type VARCHAR(50) NOT NULL DEFAULT 'other',
      original_name VARCHAR(255) NOT NULL,
      saved_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(100),
      size_bytes BIGINT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE
    )
  `);

  // Backward-compatible schema updates for existing tables.
  try {
    await pool.query("ALTER TABLE upload_supporting_files ADD COLUMN doc_type VARCHAR(50) NOT NULL DEFAULT 'other' AFTER upload_id");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

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

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN job_seeker_hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER missing_skills");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE uploads ADD COLUMN job_seeker_hidden_at TIMESTAMP NULL AFTER job_seeker_hidden");
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_skill_catalog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_id INT NOT NULL,
      skill VARCHAR(255) NOT NULL,
      UNIQUE KEY unique_job_skill (job_id, skill),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_skill_catalog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      skill VARCHAR(255) NOT NULL UNIQUE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_seekers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(50) NOT NULL,
      password VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      location VARCHAR(255) NULL,
      about_text TEXT NULL,
      linkedin_url VARCHAR(255) NULL,
      resume_name VARCHAR(255) NULL,
      resume_original_name VARCHAR(255) NULL,
      resume_saved_name VARCHAR(255) NULL,
      resume_file_path VARCHAR(500) NULL,
      resume_type VARCHAR(100) NULL,
      resume_size BIGINT NULL,
      resume_data LONGBLOB NULL,
      resume_updated_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_seeker_supporting_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_seeker_id INT NOT NULL,
      doc_type VARCHAR(50) NOT NULL DEFAULT 'other',
      original_name VARCHAR(255) NOT NULL,
      saved_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(100),
      size_bytes BIGINT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_seeker_id) REFERENCES job_seekers(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS employers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255) NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(50) NULL,
      password VARCHAR(255) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN location VARCHAR(255) NULL AFTER status");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN about_text TEXT NULL AFTER location");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN linkedin_url VARCHAR(255) NULL AFTER about_text");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN resume_name VARCHAR(255) NULL AFTER linkedin_url");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN resume_original_name VARCHAR(255) NULL AFTER resume_name");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN resume_saved_name VARCHAR(255) NULL AFTER resume_original_name");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN resume_file_path VARCHAR(500) NULL AFTER resume_saved_name");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN resume_type VARCHAR(100) NULL AFTER resume_name");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN resume_size BIGINT NULL AFTER resume_type");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN resume_data LONGBLOB NULL AFTER resume_size");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  try {
    await pool.query("ALTER TABLE job_seekers ADD COLUMN resume_updated_at TIMESTAMP NULL AFTER resume_data");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_seeker_education (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_seeker_id INT NOT NULL,
      school VARCHAR(255) NOT NULL,
      program VARCHAR(255) NULL,
      year VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_seeker_id) REFERENCES job_seekers(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_seeker_experience (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_seeker_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      company VARCHAR(255) NULL,
      year VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_seeker_id) REFERENCES job_seekers(id) ON DELETE CASCADE
    )
  `);

  // Seed a default employer entry if it does not exist.
  try {
    await pool.execute(
      `
        INSERT IGNORE INTO employers (company_name, contact_name, email, phone, password, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        "Employer 01",
        "Employer",
        "01",
        "N/A",
        "123",
        "active"
      ]
    );
  } catch (error) {
    console.error("Seed employer error:", error);
  }

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

module.exports = { initDb };
