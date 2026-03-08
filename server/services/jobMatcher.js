const { getEmbedding } = require("./embeddingService");
const { cosineSimilarity } = require("./similarityService");
const { analyzeResume } = require("./atsAnalyzer");

// Weights for calculating overall job match score:
// skill = 50%, experience = 20%, project = 15%, education = 10%, embedding = 5%
const WEIGHTS = { skill: 0.50, experience: 0.20, project: 0.15, education: 0.10, embedding: 0.05 };

const normalizeSkill = (value) => String(value || "").trim().toLowerCase();

const parseRequiredSkills = (value) =>
  String(value || "")
    .split(/[,;\n]/)
    .map((part) => part.trim())
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
  const cvAnalysis = analyzeResume(cvText);
  const cvEmbedding = await safeEmbedding(cvText);
  const cvEducationRank = getCvEducationRank(cvText);
  const cvYears = getMaxYearsMentioned(cvText);
  let results = [];

  for (let job of jobs) {
    const jobText = job.description.replace(/\s+/g, " ").slice(0, 4000);
    const jobAnalysis = analyzeResume(jobText);
    const jobEmbedding = await safeEmbedding(jobText);
    const explicitRequiredSkills = parseRequiredSkills(job.requiredSkills);
    const fallbackSkills = jobAnalysis.skillsFound;
    const sourceSkills = explicitRequiredSkills.length ? explicitRequiredSkills : fallbackSkills;
    const uniqueTargetSkills = Array.from(
      sourceSkills.reduce((map, rawSkill) => {
        const normalized = normalizeSkill(rawSkill);
        if (!normalized || map.has(normalized)) return map;
        map.set(normalized, rawSkill.trim());
        return map;
      }, new Map())
    );
    const cvSkillSet = new Set(cvAnalysis.skillsFound.map(normalizeSkill));
    const matchedSkills = uniqueTargetSkills
      .filter(([normalized]) => cvSkillSet.has(normalized))
      .map(([, raw]) => raw);
    const missingSkills = uniqueTargetSkills
      .filter(([normalized]) => !cvSkillSet.has(normalized))
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
