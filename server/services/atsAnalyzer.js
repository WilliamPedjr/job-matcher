const nlp = require('compromise');

const skillTaxonomy = [
  "javascript","react","node","express","laravel",
    "php","mysql","aws","docker","redis","flutter",
    "tensorflow","openai","python","java","c++",
    "tailwind","bootstrap","git","github","css", "html",
    "front-End", "typescript", "ES6+", "angular", "vue",
    "next", "UI", "UX", "api", "framework",
];

function analyzeResume(text) {

  const lower = text.toLowerCase();

  // Skill Detection
  const skillsFound = skillTaxonomy.filter(skill =>
    lower.includes(skill)
  );

  // Experience Score (based on years mentioned)
  const experienceMatches = lower.match(/\d+\+?\s*years?/g) || [];

  // Project Evidence Score
  const projectKeywords = [
    "developed",
    "built",
    "implemented",
    "deployed",
    "optimized",
    "integrated"
  ];

  const projectEvidence = projectKeywords.filter(word =>
    lower.includes(word)
  );

  return {
    skillsFound,
    experienceScore: Math.min(experienceMatches.length / 3, 1),
    projectScore: Math.min(projectEvidence.length / 5, 1),
    skillScore: skillsFound.length / skillTaxonomy.length
  };
}

module.exports = { analyzeResume };
