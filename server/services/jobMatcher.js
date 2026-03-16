const { getEmbedding } = require("./embeddingService");
const { cosineSimilarity } = require("./similarityService");
const { analyzeResume } = require("./atsAnalyzer");

// Weights for calculating overall job match score:
// skill = 50%, experience = 20%, project = 15%, education = 10%, embedding = 5%
const WEIGHTS = { skill: 0.50, experience: 0.20, project: 0.15, education: 0.10, embedding: 0.05 };

const normalizeSkill = (value) => String(value || "").trim().toLowerCase();
const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const canonicalizeSkillText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const aliasVariants = (normalizedSkill) => {
  const variants = new Set();
  const value = String(normalizedSkill || "");
  if (!value) return variants;

  if (/\bnode(\.js)?\b/.test(value)) {
    variants.add("node");
    variants.add("nodejs");
    variants.add("node js");
  }
  if (/\breact(\.js)?\b/.test(value)) {
    variants.add("react");
    variants.add("reactjs");
    variants.add("react js");
  }
  if (/\bnext(\.js)?\b/.test(value)) {
    variants.add("next");
    variants.add("nextjs");
    variants.add("next js");
  }
  if (/\bvue(\.js)?\b/.test(value)) {
    variants.add("vue");
    variants.add("vuejs");
    variants.add("vue js");
  }
  if (/\bexpress(\.js)?\b/.test(value)) {
    variants.add("express");
    variants.add("expressjs");
    variants.add("express js");
  }

  return variants;
};

const buildSkillVariants = (skill) => {
  const normalized = normalizeSkill(skill);
  const canonical = canonicalizeSkillText(skill);
  const compact = canonical.replace(/\s+/g, "");
  const variants = new Set([normalized, canonical, compact]);

  for (const alias of aliasVariants(normalized)) {
    const aliasCanonical = canonicalizeSkillText(alias);
    variants.add(alias);
    variants.add(aliasCanonical);
    variants.add(aliasCanonical.replace(/\s+/g, ""));
  }

  return Array.from(variants).filter(Boolean);
};

const resumeIncludesSkill = (cvRawText, cvCanonicalText, cvCompactText, skill) => {
  const variants = buildSkillVariants(skill);

  for (const variant of variants) {
    if (!variant) continue;

    if (variant.includes(" ")) {
      if (cvCanonicalText.includes(variant)) return true;
      if (cvCompactText.includes(variant.replace(/\s+/g, ""))) return true;
      continue;
    }

    const tokenRegex = new RegExp(`\\b${escapeRegExp(variant)}\\b`, "i");
    if (tokenRegex.test(cvRawText)) return true;
    if (cvCanonicalText.includes(variant)) return true;
    if (cvCompactText.includes(variant)) return true;
  }

  return false;
};

const parseRequiredSkills = (value) =>
  String(value || "")
    .split(/[,;\n|]/)
    .map((part) => part.replace(/^[\-*•]+/, "").trim())
    .filter(Boolean);

const EDUCATION_LEVEL_RANKS = {
  "high school": 1,
  "associate degree": 2,
  "bachelor's degree": 3,
  "masters degree": 4,
  "master's degree": 4,
  doctorate: 5,
  phd: 5
};

const normalizeEducation = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

const getRequiredEducationRank = (value) => {
  const normalized = normalizeEducation(value);
  if (!normalized) return 0;
  for (const [label, rank] of Object.entries(EDUCATION_LEVEL_RANKS)) {
    if (normalized.includes(label)) return rank;
  }
  return 0;
};

const getCvEducationRank = (cvText) => {
  const lower = String(cvText || "").toLowerCase();
  if (/\b(phd|doctorate|doctoral)\b/.test(lower)) return 5;
  if (/\b(master|msc|ma)\b/.test(lower)) return 4;
  if (/\b(bachelor|bsc|bs)\b/.test(lower)) return 3;
  if (/\b(associate)\b/.test(lower)) return 2;
  if (/\b(high school|secondary)\b/.test(lower)) return 1;
  return 0;
};

const getMaxYearsMentioned = (cvText) => {
  const matches = String(cvText || "").match(/(\d+)\+?\s*years?/gi) || [];
  let maxYears = 0;
  for (const match of matches) {
    const num = Number(match.match(/\d+/)?.[0] || 0);
    if (num > maxYears) maxYears = num;
  }
  return maxYears;
};

async function safeEmbedding(text) {
  try {
    return await getEmbedding(text);
  } catch {
    return null;
  }
}

async function matchJobs(cvText, jobs) {
  const cvRawText = String(cvText || "");
  const cvCanonicalText = canonicalizeSkillText(cvRawText);
  const cvCompactText = cvCanonicalText.replace(/\s+/g, "");
  const cvAnalysis = analyzeResume(cvRawText);
  const cvEmbedding = await safeEmbedding(cvRawText);
  const cvEducationRank = getCvEducationRank(cvRawText);
  const cvYears = getMaxYearsMentioned(cvRawText);
  const cvSkillSet = new Set(cvAnalysis.skillsFound.map(normalizeSkill));
  let results = [];

  for (let job of jobs) {
    const jobText = String(job.description || "").replace(/\s+/g, " ").slice(0, 4000);
    const jobAnalysis = analyzeResume(jobText);
    const jobEmbedding = await safeEmbedding(jobText);
    const explicitRequiredSkills = parseRequiredSkills(job.requiredSkills);
    const fallbackSkills = jobAnalysis.skillsFound;
    const sourceSkills = explicitRequiredSkills.length ? explicitRequiredSkills : fallbackSkills;
    const uniqueTargetSkills = Array.from(
      sourceSkills.reduce((map, rawSkill) => {
        const normalized = normalizeSkill(rawSkill);
        const canonical = canonicalizeSkillText(rawSkill);
        const dedupeKey = canonical || normalized;
        if (!dedupeKey || map.has(dedupeKey)) return map;
        map.set(dedupeKey, rawSkill.trim());
        return map;
      }, new Map())
    );
    const matchedSkills = uniqueTargetSkills
      .filter(([, raw]) => {
        const normalizedRaw = normalizeSkill(raw);
        return cvSkillSet.has(normalizedRaw) || resumeIncludesSkill(cvRawText, cvCanonicalText, cvCompactText, raw);
      })
      .map(([, raw]) => raw);
    const missingSkills = uniqueTargetSkills
      .filter(([, raw]) => {
        const normalizedRaw = normalizeSkill(raw);
        return !(cvSkillSet.has(normalizedRaw) || resumeIncludesSkill(cvRawText, cvCanonicalText, cvCompactText, raw));
      })
      .map(([, raw]) => raw);
    const skillScore = uniqueTargetSkills.length === 0 ? 0 : matchedSkills.length / uniqueTargetSkills.length;
    const requiredYears = Number(job.minimumExperienceYears || 0);
    const experienceScore = requiredYears > 0
      ? (cvYears > 0 ? Math.min(cvYears / requiredYears, 1) : cvAnalysis.experienceScore * 0.5)
      : cvAnalysis.experienceScore;
    const requiredEducationRank = getRequiredEducationRank(job.minimumEducation);
    const educationScore = requiredEducationRank > 0
      ? (cvEducationRank > 0 ? Math.min(cvEducationRank / requiredEducationRank, 1) : 0)
      : 1;
    const projectScore = cvAnalysis.projectScore;
    const embeddingScore = (cvEmbedding && jobEmbedding) ? cosineSimilarity(cvEmbedding, jobEmbedding) : 0;

    const finalScore = (skillScore * WEIGHTS.skill) +
                       (experienceScore * WEIGHTS.experience) +
                       (educationScore * WEIGHTS.education) +
                       (projectScore * WEIGHTS.project) +
                       (embeddingScore * WEIGHTS.embedding);
    const percentageScore = finalScore * 100;
    let classification = "Not Qualified";

    if (percentageScore >= 80) {
      classification = "Highly Qualified";
    } else if (percentageScore >= 60) {
      classification = "Moderately Qualified";
    }

    results.push({
      ...job,
      score: percentageScore.toFixed(2),
      classification,
      matchedSkills,
      missingSkills,
      skillScore: (skillScore * 100).toFixed(2),
      experienceScore: (experienceScore * 100).toFixed(2),
      educationScore: (educationScore * 100).toFixed(2),
      projectScore: (projectScore * 100).toFixed(2),
      embeddingScore: (embeddingScore * 100).toFixed(2)
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

module.exports = { matchJobs };
