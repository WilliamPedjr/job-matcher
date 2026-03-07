const nlp = require('compromise');

function extractSkills(text) {

  const doc = nlp(text.toLowerCase());

  // Extract noun phrases (usually tech skills are nouns)
  const terms = doc.nouns().out('array');

  const techKeywords = [
    "javascript","react","node","express","laravel",
    "php","mysql","aws","docker","redis","flutter",
    "tensorflow","openai","python","java","c++",
    "tailwind","bootstrap","git","github","css", "html",
    "front-End", "typescript", "ES6+", "angular", "vue",
    "next", "UI", "UX", "api", "framework",
  ];

  // Merge NLP extracted + known tech keywords
  const extracted = new Set();

  terms.forEach(term => {
    techKeywords.forEach(skill => {
      if (term.includes(skill)) {
        extracted.add(skill);
      }
    });
  });

  return Array.from(extracted);
}

module.exports = { extractSkills };