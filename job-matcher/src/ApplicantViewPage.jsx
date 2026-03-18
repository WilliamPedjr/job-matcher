import "./ApplicantViewPage.css"

function parseSkills(skillsText) {
  return (skillsText || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseMissingSkills(skillsText) {
  return (skillsText || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function extractEducationLines(text) {
  const source = (text || "").replace(/\r/g, "\n")
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const directMatches = lines
    .filter((line) => /(university|college|school|institute|academy)/i.test(line))
    .slice(0, 6)

  if (directMatches.length) {
    return directMatches
  }

  const compact = source.replace(/\s+/g, " ").trim()
  const chunks = compact
    .split(/(?=\b(?:elementary|high school|college|university|institute|academy|bachelor|master|phd|associate)\b)/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /(school|college|university|institute|academy|bachelor|master|phd|associate)/i.test(chunk))
    .map((chunk) => chunk.replace(/\s*(work history|experience|skills|summary)\b.*/i, "").trim())
    .filter(Boolean)

  return Array.from(new Set(chunks)).slice(0, 6)
}

function extractExperienceLines(text) {
  const source = (text || "").replace(/\r/g, "\n")
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  const experienceHeaderPattern = /^(work\s+experience|professional\s+experience|employment|employment\s+history|work\s+history|experience)\s*:?\s*$/i
  const stopHeaderPattern = /^(education|skills?|projects?|certifications?|summary|profile|references)\s*:?\s*$/i
  const dateRangePattern = /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|\d{4})\s*(?:-|–|to)\s*(?:present|current|now|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|\d{4}))\b/i
  const titlePattern = /\b(?:software|frontend|front-end|backend|full[-\s]?stack|web|mobile|qa|test|data|product|project|systems?)?\s*(?:engineer|developer|analyst|manager|lead|specialist|consultant|intern|assistant|architect|administrator|officer|designer)\b/i
  const companyPattern = /\b(?:at|with)\s+[A-Z][A-Za-z0-9&.,\- ]{1,80}\b|\b[A-Z][A-Za-z0-9&.,\- ]+\s(?:inc\.?|corp\.?|llc|ltd)\b/i
  const yearsPattern = /\d+\+?\s*years?/i
  const bulletActionPattern = /^(created|developed|implemented|designed|optimized|built|improved|maintained|led|managed|automated|deployed|integrated)\b/i

  const sectionLines = []
  let inExperienceSection = false
  for (const line of lines) {
    if (experienceHeaderPattern.test(line)) {
      inExperienceSection = true
      continue
    }
    if (stopHeaderPattern.test(line)) {
      inExperienceSection = false
      continue
    }
    if (inExperienceSection) {
      sectionLines.push(line)
    }
  }

  const pool = sectionLines.length ? sectionLines : lines
  const results = []
  const seen = new Set()

  for (let i = 0; i < pool.length; i += 1) {
    const line = pool[i]
    const isAnchor = dateRangePattern.test(line) || titlePattern.test(line) || companyPattern.test(line) || yearsPattern.test(line)
    if (!isAnchor || line.length < 8) continue

    let entry = line
    const next = pool[i + 1]
    if (next && bulletActionPattern.test(next) && next.length > 12) {
      entry = `${entry} | ${next}`
      i += 1
    }

    const normalized = entry.toLowerCase()
    if (!seen.has(normalized)) {
      seen.add(normalized)
      results.push(entry)
    }
    if (results.length >= 8) break
  }

  return results
}

function ApplicantViewPage({ viewItem, onBack, onReanalyze, readOnly = false }) {
  const detectedEducation = extractEducationLines(viewItem?.extracted_text)
  const detectedExperience = extractExperienceLines(viewItem?.extracted_text)
  const matchedSkills = parseSkills(viewItem?.matched_skills)
  const missingSkills = parseMissingSkills(viewItem?.missing_skills)
  const overall = viewItem?.match_score != null ? Number(viewItem.match_score) : 0
  const skillsMatch = Math.min(100, matchedSkills.length * 12)
  const educationMatch = detectedEducation.length ? 60 : 10
  const experienceMatch = detectedExperience.length ? 55 : 0
  const projectMatch = viewItem?.project_score != null ? Number(viewItem.project_score) : 0

  return (
    <section className="candidate-page">
      <div className="candidate-head">
        <div>
          <h2 className="candidate-name">{viewItem?.name || "(No name)"}</h2>
          <p className="candidate-role">
            Applied for <strong>{viewItem?.applied_job_title || viewItem?.matched_job_title || "No matched role yet"}</strong>
          </p>
        </div>
        <div className="candidate-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            {readOnly ? "Back" : "Back to Applicants"}
          </button>
          {!readOnly && (
            <button className="btn btn-secondary" onClick={onReanalyze}>Re-Analyze</button>
          )}
        </div>
      </div>

      <div className="candidate-layout">
        <div className="candidate-left">
          <section className="candidate-card">
            <h3>Contact Information</h3>
            <p>{viewItem?.email || "No email"}</p>
            <p>{viewItem?.phone || "No phone"}</p>
            <p>{viewItem?.original_name || "-"}</p>
          </section>

          <section className="candidate-card">
            <h3>Skills</h3>
            <p className="card-note">Extracted from resume using NLP analysis</p>
            <div className="skills-cloud">
              {matchedSkills.length ? (
                matchedSkills.map((skill) => (
                  <span key={skill} className="skill-pill">{skill}</span>
                ))
              ) : (
                <span className="muted">No matched skills found.</span>
              )}
            </div>
          </section>

          <section className="candidate-card">
            <h3>Education</h3>
            {detectedEducation.length ? (
              detectedEducation.map((line, idx) => (
                <p key={`${line}-${idx}`}>{line}</p>
              ))
            ) : (
              <p className="muted">No education data extracted.</p>
            )}
          </section>

          <section className="candidate-card">
            <h3>Work Experience</h3>
            {detectedExperience.length ? (
              detectedExperience.map((line, idx) => (
                <p key={`${line}-${idx}`}>{line}</p>
              ))
            ) : (
              <p className="muted">No clear work experience extracted.</p>
            )}
          </section>

          <section className="candidate-card">
            <h3>Extracted Resume Data</h3>
            {viewItem?.extracted_text ? (
              <div className="extracted-block">
                <pre>{viewItem.extracted_text}</pre>
              </div>
            ) : (
              <p className="muted">No extracted resume text available.</p>
            )}
          </section>
        </div>

        <div className="candidate-right">
          <section className="candidate-card">
            <h3>Qualification Status</h3>
            <p className={`status-chip ${(viewItem?.classification || "").toLowerCase().replace(/\s+/g, "-")}`}>
              {viewItem?.classification || "Not Qualified"}
            </p>
            <div className="overall-box">
              <p className="overall-score">{`${overall.toFixed(0)}%`}</p>
              <p>Overall Match Score</p>
            </div>
          </section>

          <section className="candidate-card">
            <h3>Match Score Breakdown</h3>
            <div className="breakdown-list">
              <div className="bar-row">
                <div className="bar-label"><span>Overall Match</span><strong>{overall.toFixed(0)}%</strong></div>
                <div className="bar"><div style={{ width: `${overall}%` }} /></div>
              </div>
              <div className="bar-row">
                <div className="bar-label"><span>Skills Match</span><strong>{skillsMatch}%</strong></div>
                <div className="bar"><div style={{ width: `${skillsMatch}%` }} /></div>
              </div>
              <div className="bar-row">
                <div className="bar-label"><span>Education Match</span><strong>{educationMatch}%</strong></div>
                <div className="bar"><div style={{ width: `${educationMatch}%` }} /></div>
              </div>
              <div className="bar-row">
                <div className="bar-label"><span>Experience Match</span><strong>{experienceMatch}%</strong></div>
                <div className="bar"><div style={{ width: `${experienceMatch}%` }} /></div>
              </div>
              <div className="bar-row">
                <div className="bar-label"><span>Project Match</span><strong>{projectMatch.toFixed(0)}%</strong></div>
                <div className="bar"><div style={{ width: `${projectMatch}%` }} /></div>
              </div>
            </div>
          </section>

          <section className="candidate-card">
            <h3>Missing Skills</h3>
            {missingSkills.length ? (
              <div className="skills-cloud">
                {missingSkills.map((skill) => (
                  <span key={`missing-${skill}`} className="skill-pill">{skill}</span>
                ))}
              </div>
            ) : (
              <p className="muted">No missing skills detected.</p>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

export default ApplicantViewPage
