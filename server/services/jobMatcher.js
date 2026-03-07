const { getEmbedding } = require("./embeddingService");
const { cosineSimilarity } = require("./similarityService");
const { analyzeResume } = require("./atsAnalyzer");

// Weights for calculating overall job match score:
// skill = 55%, experience = 20%, project = 20%, embedding = 5%
const WEIGHTS = { skill: 0.55, experience: 0.20, project: 0.20, embedding: 0.05 };

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
  let results = [];

  for (let job of jobs) {
    const jobText = job.description.replace(/\s+/g, " ").slice(0, 4000);
    const jobAnalysis = analyzeResume(jobText);
    const jobEmbedding = await safeEmbedding(jobText);

    const matchedSkills = cvAnalysis.skillsFound.filter(skill => jobAnalysis.skillsFound.includes(skill));
    const missingSkills = jobAnalysis.skillsFound.filter(skill => !matchedSkills.includes(skill));
    const skillScore = jobAnalysis.skillsFound.length === 0 ? 0 : matchedSkills.length / jobAnalysis.skillsFound.length;
    const experienceScore = cvAnalysis.experienceScore;
    const projectScore = cvAnalysis.projectScore;
    const embeddingScore = (cvEmbedding && jobEmbedding) ? cosineSimilarity(cvEmbedding, jobEmbedding) : 0;

    const finalScore = (skillScore * WEIGHTS.skill) +
                       (experienceScore * WEIGHTS.experience) +
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
      projectScore: (projectScore * 100).toFixed(2),
      embeddingScore: (embeddingScore * 100).toFixed(2)
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

module.exports = { matchJobs };
