<?php

namespace App\Services;

use App\Models\GlobalSkillCatalog;
use App\Models\Job;
use Illuminate\Support\Str;

class ResumeAnalysisService
{
    public function __construct(
        private readonly TextExtractionService $textExtractionService,
        private readonly PdsExtractionService $pdsExtractionService
    ) {
    }

    public function analyzeFile(
        string $path,
        ?string $mimeType = null,
        string $appliedJobTitle = '',
        string $supportingText = ''
    ): array {
        $extractedText = $this->textExtractionService->extract($path, $mimeType);

        if ($supportingText !== '') {
            $extractedText = trim($extractedText . "\n" . $supportingText);
        }

        if (mb_strlen(trim($extractedText)) < 30) {
            throw new \RuntimeException('Could not extract readable text from the uploaded file.');
        }

        $resumeText = $this->normalizeWhitespace($extractedText);
        $pdsFormat = $this->pdsExtractionService->format($extractedText);
        $isPds = ($pdsFormat['detected'] ?? false) === true;
        $analysisText = $this->analysisTextForMatching($resumeText, $pdsFormat);
        $globalSkills = GlobalSkillCatalog::query()->pluck('skill')->all();

        $job = null;
        if ($appliedJobTitle !== '') {
            $job = Job::query()
                ->whereRaw('LOWER(title) = ?', [Str::lower(trim($appliedJobTitle))])
                ->first();
        }

        $requiredSkills = $this->splitSkills($job?->required_skills ?? '');
        if (!$requiredSkills) {
            $requiredSkills = $this->buildSkillSuggestions($analysisText, $globalSkills);
        }

        $matchedSkills = $this->findMatchedSkills($analysisText, $requiredSkills ?: $globalSkills);
        $missingSkills = array_values(array_diff($requiredSkills, $matchedSkills));

        $skillsScore = $this->calculateSkillsScore($requiredSkills, $matchedSkills);
        $projectScore = $this->calculateProjectScore($analysisText);
        $educationLines = $isPds
            ? $this->pdsSummaryLines($pdsFormat, 'education')
            : $this->extractEducationLines($extractedText);
        $experienceLines = $isPds
            ? $this->pdsSummaryLines($pdsFormat, 'experience')
            : $this->extractExperienceLines($extractedText);

        $minimumEducation = (string) ($job?->minimum_education ?? '');
        $minimumExperienceYears = (int) ($job?->minimum_experience_years ?? 0);
        $educationScore = $this->calculateEducationScore($educationLines, $minimumEducation);
        $experienceScore = $this->calculateExperienceScore($experienceLines, $minimumExperienceYears);
        $overall = round(($skillsScore * 0.55) + ($experienceScore * 0.2) + ($educationScore * 0.15) + ($projectScore * 0.1), 2);
        $summarySourceText = $isPds && $analysisText !== '' ? $analysisText : $extractedText;
        $summary = $this->buildResumeSummary(
            $summarySourceText,
            $matchedSkills,
            $missingSkills,
            $educationLines,
            $experienceLines,
            $projectScore,
            $overall,
            $pdsFormat
        );

        return [
            'classification' => $overall >= 80 ? 'Highly Qualified' : ($overall >= 60 ? 'Moderately Qualified' : 'Not Qualified'),
            'overall_score' => $overall,
            'skills_match_score' => $skillsScore,
            'project_score' => $projectScore,
            'education_match_score' => $educationScore,
            'experience_match_score' => $experienceScore,
            'matched_skills' => $matchedSkills,
            'missing_skills' => $missingSkills,
            'education_text' => implode("\n", $educationLines),
            'experience_text' => implode("\n", $experienceLines),
            'resume_text' => $resumeText,
            'preview_text' => Str::limit($summary['summary_text'] !== '' ? $summary['summary_text'] : ($isPds && $analysisText !== '' ? $analysisText : $resumeText), 1000, ''),
            'summary_text' => $summary['summary_text'],
            'resume_summary' => $summary,
            'pds_format' => $pdsFormat,
            'matched_job_title' => $job?->title ?: ($appliedJobTitle !== '' ? $appliedJobTitle : null),
        ];
    }

    public function matchJobs(string $resumeText, iterable $jobs): array
    {
        $globalSkills = GlobalSkillCatalog::query()->pluck('skill')->all();
        $resumeText = $this->normalizeWhitespace($resumeText);
        $pdsFormat = $this->pdsExtractionService->format($resumeText);
        $isPds = ($pdsFormat['detected'] ?? false) === true;
        $analysisText = $this->analysisTextForMatching($resumeText, $pdsFormat);
        $educationLines = $isPds
            ? $this->pdsSummaryLines($pdsFormat, 'education')
            : $this->extractEducationLines($resumeText);
        $experienceLines = $isPds
            ? $this->pdsSummaryLines($pdsFormat, 'experience')
            : $this->extractExperienceLines($resumeText);
        $results = [];

        foreach ($jobs as $job) {
            $requiredSkills = $this->splitSkills((string) $this->jobField($job, 'requiredSkills', 'required_skills', ''));
            if (!$requiredSkills) {
                $requiredSkills = $this->buildSkillSuggestions($analysisText, $globalSkills);
            }

            $matchedSkills = $this->findMatchedSkills($analysisText, $requiredSkills ?: $globalSkills);
            $missingSkills = array_values(array_diff($requiredSkills, $matchedSkills));
            $skillsScore = $this->calculateSkillsScore($requiredSkills, $matchedSkills);
            $projectScore = $this->calculateProjectScore($analysisText);
            $educationScore = $this->calculateEducationScore(
                $educationLines,
                (string) $this->jobField($job, 'minimumEducation', 'minimum_education', '')
            );
            $experienceScore = $this->calculateExperienceScore(
                $experienceLines,
                (int) $this->jobField($job, 'minimumExperienceYears', 'minimum_experience_years', 0)
            );
            $overall = round(($skillsScore * 0.55) + ($experienceScore * 0.2) + ($educationScore * 0.15) + ($projectScore * 0.1), 2);

            $results[] = [
                'id' => $this->jobField($job, 'id'),
                'title' => $this->jobField($job, 'title'),
                'description' => $this->jobField($job, 'description'),
                'status' => $this->jobField($job, 'status', null, 'active'),
                'department' => $this->jobField($job, 'department'),
                'location' => $this->jobField($job, 'location'),
                'type' => $this->jobField($job, 'type'),
                'requiredSkills' => implode(', ', $requiredSkills),
                'minimumEducation' => $this->jobField($job, 'minimumEducation', 'minimum_education', ''),
                'minimumExperienceYears' => $this->jobField($job, 'minimumExperienceYears', 'minimum_experience_years', 0),
                'overallScore' => $overall,
                'classification' => $overall >= 80 ? 'Highly Qualified' : ($overall >= 60 ? 'Moderately Qualified' : 'Not Qualified'),
                'matchedSkills' => $matchedSkills,
                'missingSkills' => $missingSkills,
                'skillsScore' => $skillsScore,
                'projectScore' => $projectScore,
                'educationScore' => $educationScore,
                'experienceScore' => $experienceScore,
            ];
        }

        usort($results, fn ($left, $right) => $right['overallScore'] <=> $left['overallScore']);

        return $results;
    }

    private function analysisTextForMatching(string $resumeText, array $pdsFormat): string
    {
        if (($pdsFormat['detected'] ?? false) !== true) {
            return $resumeText;
        }

        return $this->normalizeWhitespace((string) ($pdsFormat['matching_text'] ?? ''));
    }

    private function pdsSummaryLines(array $pdsFormat, string $key): array
    {
        $items = $pdsFormat[$key] ?? [];
        if (!is_array($items)) {
            return [];
        }

        return array_values(array_filter(array_map(
            fn ($item) => trim((string) $item),
            $items
        )));
    }

    private function jobField(mixed $job, string $camelKey, ?string $snakeKey = null, mixed $default = null): mixed
    {
        $value = data_get($job, $camelKey);
        if ($value !== null) {
            return $value;
        }

        if ($snakeKey !== null) {
            $value = data_get($job, $snakeKey);
            if ($value !== null) {
                return $value;
            }
        }

        return $default;
    }

    private function splitSkills(string $skills): array
    {
        return array_values(array_filter(array_map(
            fn ($item) => trim($item),
            preg_split('/[,;\n|]+/', $skills) ?: []
        )));
    }

    private function buildSkillSuggestions(string $resumeText, array $globalSkills): array
    {
        $taxonomy = array_values(array_unique(array_merge($this->skillTaxonomy(), $globalSkills)));
        $matches = [];

        foreach ($taxonomy as $skill) {
            if ($this->resumeIncludesSkill($resumeText, $skill)) {
                $matches[] = trim((string) $skill);
            }
        }

        return array_values(array_unique(array_filter($matches)));
    }

    private function findMatchedSkills(string $resumeText, array $skills): array
    {
        $matches = [];
        $haystack = Str::lower($resumeText);
        $canonical = $this->canonicalizeSkillText($resumeText);
        $compact = str_replace(' ', '', $canonical);

        foreach ($skills as $skill) {
            $normalized = trim((string) $skill);
            if ($normalized === '') {
                continue;
            }
            if ($this->resumeIncludesSkill($haystack, $normalized, $canonical, $compact)) {
                $matches[] = $normalized;
            }
        }

        return array_values(array_unique($matches));
    }

    private function calculateSkillsScore(array $requiredSkills, array $matchedSkills): float
    {
        if (!$requiredSkills) {
            return 0.0;
        }

        return round((count($matchedSkills) / max(count($requiredSkills), 1)) * 100, 2);
    }

    private function calculateProjectScore(string $text): float
    {
        $lower = Str::lower($text);
        $keywords = ['developed', 'built', 'implemented', 'deployed', 'optimized', 'integrated'];
        $matches = 0;

        foreach ($keywords as $keyword) {
            if (Str::contains($lower, $keyword)) {
                $matches++;
            }
        }

        return round(min($matches / max(count($keywords), 1), 1) * 100, 2);
    }

    private function buildResumeSummary(
        string $sourceText,
        array $matchedSkills,
        array $missingSkills,
        array $educationLines,
        array $experienceLines,
        float $projectScore,
        float $overallScore,
        array $pdsFormat = []
    ): array {
        $profileLines = $this->extractProfileLines($sourceText);
        $projectLines = $this->extractProjectLines($sourceText);
        $skillHighlights = array_slice(array_values($matchedSkills), 0, 10);
        $missingHighlights = array_slice(array_values($missingSkills), 0, 8);
        $experienceHighlights = array_slice($experienceLines, 0, 4);
        $educationHighlights = array_slice($educationLines, 0, 3);
        $projectHighlights = array_slice($projectLines, 0, 4);

        $parts = [];
        if ($profileLines) {
            $parts[] = implode(' ', array_slice($profileLines, 0, 2));
        }
        if ($skillHighlights) {
            $parts[] = 'Key skills: ' . implode(', ', $skillHighlights) . '.';
        }
        if ($experienceHighlights) {
            $parts[] = 'Experience: ' . implode(' | ', $experienceHighlights) . '.';
        }
        if ($educationHighlights) {
            $parts[] = 'Education: ' . implode(' | ', $educationHighlights) . '.';
        }
        if ($projectHighlights) {
            $parts[] = 'Project evidence: ' . implode(' | ', $projectHighlights) . '.';
        } elseif ($projectScore > 0) {
            $parts[] = 'Project evidence found through action-oriented resume statements.';
        }
        if ($missingHighlights) {
            $parts[] = 'Potential gaps against the target role: ' . implode(', ', $missingHighlights) . '.';
        }

        $summaryText = trim(preg_replace('/\s+/u', ' ', implode(' ', $parts)));

        return [
            'summary_text' => $summaryText,
            'profile' => $profileLines,
            'skills' => $skillHighlights,
            'experience' => $experienceHighlights,
            'education' => $educationHighlights,
            'projects' => $projectHighlights,
            'gaps' => $missingHighlights,
            'pds' => $pdsFormat,
            'confidence' => $this->summarizationConfidence($summaryText, $matchedSkills, $educationLines, $experienceLines, $overallScore),
        ];
    }

    private function summarizationConfidence(
        string $summaryText,
        array $matchedSkills,
        array $educationLines,
        array $experienceLines,
        float $overallScore
    ): string {
        $signals = 0;
        $signals += $summaryText !== '' ? 1 : 0;
        $signals += count($matchedSkills) >= 3 ? 1 : 0;
        $signals += $educationLines ? 1 : 0;
        $signals += $experienceLines ? 1 : 0;
        $signals += $overallScore > 0 ? 1 : 0;

        return $signals >= 4 ? 'high' : ($signals >= 2 ? 'medium' : 'low');
    }

    private function extractProfileLines(string $text): array
    {
        $sectionBlock = $this->extractSectionBlock($text, [
            'summary',
            'professional summary',
            'profile',
            'career profile',
            'objective',
            'career objective',
            'about me',
        ], [
            'skills',
            'skill',
            'work experience',
            'professional experience',
            'employment',
            'employment history',
            'work history',
            'education',
            'projects',
            'project',
            'certifications',
            'certification',
            'references',
            'reference',
        ]);

        if ($sectionBlock === '') {
            return [];
        }

        $lines = array_values(array_filter(array_map(
            fn ($line) => trim(preg_replace('/\s+/u', ' ', (string) $line)),
            preg_split("/\n+/", str_replace("\r", "\n", $sectionBlock)) ?: []
        )));

        $headerPattern = '/^(summary|professional\s+summary|profile|career\s+profile|objective|career\s+objective|about\s+me)\s*:?\s*$/i';
        $results = [];
        foreach ($lines as $line) {
            $line = trim((string) preg_replace('/^(summary|professional\s+summary|profile|career\s+profile|objective|career\s+objective|about\s+me)\s*:?\s*/i', '', $line));
            if ($line === '' || preg_match($headerPattern, $line)) {
                continue;
            }
            if (mb_strlen($line) < 20) {
                continue;
            }
            $results[] = Str::limit($line, 220, '');
            if (count($results) >= 3) {
                break;
            }
        }

        return $results;
    }

    private function extractProjectLines(string $text): array
    {
        $sectionBlock = $this->extractSectionBlock($text, [
            'projects',
            'project',
            'portfolio',
            'selected projects',
            'academic projects',
        ], [
            'work experience',
            'professional experience',
            'employment',
            'employment history',
            'work history',
            'education',
            'skills',
            'skill',
            'certifications',
            'certification',
            'summary',
            'profile',
            'references',
            'reference',
        ]);

        $normalized = str_replace("\r", "\n", $sectionBlock !== '' ? $sectionBlock : $text);
        $lines = array_values(array_filter(array_map(
            fn ($line) => trim(preg_replace('/\s+/u', ' ', (string) $line)),
            preg_split("/\n+/", $normalized) ?: []
        )));

        $projectSignal = '/\b(?:project|developed|built|implemented|deployed|optimized|integrated|designed|created|automated|launched|github|portfolio)\b/i';
        $headerPattern = '/^(projects?|portfolio|selected\s+projects|academic\s+projects)\s*:?\s*$/i';
        $results = [];
        $seen = [];
        foreach ($lines as $line) {
            $line = trim((string) preg_replace('/^(projects?|portfolio|selected\s+projects|academic\s+projects)\s*:?\s*/i', '', $line));
            if (preg_match($headerPattern, $line) || !preg_match($projectSignal, $line)) {
                continue;
            }

            $entry = trim((string) Str::limit($line, 220, ''));
            $key = Str::lower($entry);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $results[] = $entry;
            if (count($results) >= 6) {
                break;
            }
        }

        return $results;
    }

    private function calculateEducationScore(array $educationLines, string $minimumEducation): float
    {
        $min = Str::lower($minimumEducation);
        if ($min === '') {
            return 50.0;
        }

        $haystack = Str::lower(implode(' ', $educationLines));
        $score = 0.0;

        if (Str::contains($min, 'phd') || Str::contains($min, 'doctor')) {
            $score = Str::contains($haystack, ['phd', 'doctor']) ? 100.0 : 0.0;
        } elseif (Str::contains($min, 'master')) {
            $score = Str::contains($haystack, ['master', 'msc', 'ma', 'ms']) ? 100.0 : 50.0;
        } elseif (Str::contains($min, 'bachelor') || Str::contains($min, 'college') || Str::contains($min, 'university')) {
            $score = Str::contains($haystack, ['bachelor', 'college', 'university', 'bs', 'ba']) ? 100.0 : 50.0;
        } elseif (Str::contains($min, 'high school')) {
            $score = Str::contains($haystack, ['high school', 'secondary']) ? 100.0 : 60.0;
        } else {
            $score = Str::contains($haystack, $min) ? 100.0 : 50.0;
        }

        return $score;
    }

    private function calculateExperienceScore(array $experienceLines, int $minimumYears): float
    {
        if ($minimumYears <= 0) {
            return 50.0;
        }

        $joined = implode(' ', $experienceLines);
        preg_match_all('/(\d+)\+?\s*years?/i', $joined, $matches);
        $years = 0;
        foreach ($matches[1] ?? [] as $value) {
            $years = max($years, (int) $value);
        }

        if ($years >= $minimumYears) {
            return 100.0;
        }

        return max(0.0, min(100.0, ($years / max($minimumYears, 1)) * 100));
    }

    private function skillTaxonomy(): array
    {
        return [
            'javascript',
            'react',
            'react.js',
            'node',
            'node.js',
            'express',
            'express.js',
            'laravel',
            'php',
            'mysql',
            'aws',
            'docker',
            'redis',
            'flutter',
            'tensorflow',
            'openai',
            'python',
            'java',
            'c++',
            'tailwind',
            'bootstrap',
            'git',
            'github',
            'css',
            'html',
            'typescript',
            'es6+',
            'angular',
            'vue',
            'next',
            'ui',
            'ux',
            'api',
            'framework',
        ];
    }

    private function normalizeSkill(string $value): string
    {
        return trim(Str::lower($value));
    }

    private function canonicalizeSkillText(string $value): string
    {
        return Str::of($value)
            ->lower()
            ->replaceMatches('/[^a-z0-9+#]+/', ' ')
            ->squish()
            ->toString();
    }

    private function aliasVariants(string $normalizedSkill): array
    {
        $variants = [];
        $value = trim($normalizedSkill);
        if ($value === '') {
            return $variants;
        }

        if (preg_match('/\bnode(\.js)?\b/', $value) === 1) {
            $variants = array_merge($variants, ['node', 'nodejs', 'node js']);
        }
        if (preg_match('/\breact(\.js)?\b/', $value) === 1) {
            $variants = array_merge($variants, ['react', 'reactjs', 'react js']);
        }
        if (preg_match('/\bnext(\.js)?\b/', $value) === 1) {
            $variants = array_merge($variants, ['next', 'nextjs', 'next js']);
        }
        if (preg_match('/\bvue(\.js)?\b/', $value) === 1) {
            $variants = array_merge($variants, ['vue', 'vuejs', 'vue js']);
        }
        if (preg_match('/\bexpress(\.js)?\b/', $value) === 1) {
            $variants = array_merge($variants, ['express', 'expressjs', 'express js']);
        }

        return array_values(array_unique(array_filter($variants)));
    }

    private function buildSkillVariants(string $skill): array
    {
        $normalized = $this->normalizeSkill($skill);
        $canonical = $this->canonicalizeSkillText($skill);
        $compact = str_replace(' ', '', $canonical);
        $variants = array_filter(array_unique(array_merge(
            [$normalized, $canonical, $compact],
            $this->aliasVariants($normalized)
        )));

        return array_values($variants);
    }

    private function resumeIncludesSkill(string $resumeText, string $skill, ?string $canonicalResume = null, ?string $compactResume = null): bool
    {
        $rawResume = Str::lower($resumeText);
        $canonicalResume ??= $this->canonicalizeSkillText($resumeText);
        $compactResume ??= str_replace(' ', '', $canonicalResume);

        foreach ($this->buildSkillVariants($skill) as $variant) {
            if ($variant === '') {
                continue;
            }

            if (str_contains($variant, ' ')) {
                if (str_contains($canonicalResume, $variant) || str_contains($compactResume, str_replace(' ', '', $variant))) {
                    return true;
                }
                continue;
            }

            if (preg_match('/\b' . preg_quote($variant, '/') . '\b/i', $rawResume) === 1) {
                return true;
            }
            if (str_contains($canonicalResume, $variant) || str_contains($compactResume, $variant)) {
                return true;
            }
        }

        return false;
    }

    private function cleanResumeSnippet(string $value): string
    {
        $value = str_replace(["\r", "\t"], ' ', $value);
        $value = preg_replace('/\s+/u', ' ', $value);
        $value = preg_replace('/\s+([,.;:])/u', '$1', (string) $value);
        $value = preg_replace('/^[\s\-|:;,.]+|[\s\-|:;,.]+$/u', '', (string) $value);

        return trim((string) $value);
    }

    private function cleanDanglingWords(string $value): string
    {
        return trim((string) preg_replace('/(?:,?\s+(?:and|or|with|using|including|such as|for|to|of|in|at|by))\s*$/i', '', $value));
    }

    private function cleanEducationEntry(string $value): string
    {
        $value = $this->cleanResumeSnippet($value);
        $value = preg_replace('/^(?:education|educational\s+background|academic\s+background|academic\s+history|qualifications?|studies?|study|schooling|training)\s*:?\s*/i', '', $value);
        $value = preg_replace('/\b(?:work\s+experience|professional\s+experience|employment|skills?|projects?|certifications?|summary|profile|references|contact|address|phone|email)\b.*$/i', '', (string) $value);
        $value = preg_replace('/\bEDUCATION\b/i', '', (string) $value);
        $value = preg_replace('/\(?\bfield\s+not\s+specified\b\)?/i', '', (string) $value);
        $value = preg_replace('/^(secondary|elementary)\s+(.+\b(?:school|high\s+school|elementary)\b)$/i', '$2 - $1', (string) $value);

        return $this->cleanDanglingWords($this->cleanResumeSnippet((string) $value));
    }

    private function splitEducationEntry(string $entry): array
    {
        $entry = $this->cleanEducationEntry($entry);
        if ($entry === '') {
            return [];
        }

        $institutionPattern = '/\b(?:(?!(?:Bachelor|Master|Doctor|Degree|Field|Secondary|Elementary|Diploma|Certificate)\b)(?:[A-Z][A-Za-z.&\']+|of|the|and)\s+){0,7}(?:University|College|Institute|Academy|(?:National\s+)?High\s+School|Elementary(?:\s+School)?|School)\b/';
        preg_match_all($institutionPattern, $entry, $matches, PREG_OFFSET_CAPTURE);
        $institutions = $matches[0] ?? [];

        if (count($institutions) <= 1) {
            return [$entry];
        }

        $parts = [];
        for ($i = 0; $i < count($institutions); $i++) {
            $start = (int) $institutions[$i][1];
            $end = isset($institutions[$i + 1])
                ? (int) $institutions[$i + 1][1]
                : strlen($entry);

            $part = $this->cleanEducationEntry(substr($entry, $start, $end - $start));
            if ($part !== '') {
                $parts[] = $part;
            }
        }

        return $parts ?: [$entry];
    }

    private function addUniqueEntries(array &$results, array &$seen, array $entries, int $limit): void
    {
        foreach ($entries as $entry) {
            $entry = $this->cleanResumeSnippet($entry);
            if ($entry === '') {
                continue;
            }

            $key = Str::lower($entry);
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $results[] = $entry;
            if (count($results) >= $limit) {
                return;
            }
        }
    }

    private function cleanExperienceEntry(string $value): string
    {
        $value = str_replace(["\u{2022}", "\u{25CF}", "\u{25AA}", "\u{2013}", "\u{2014}"], [' - ', ' - ', ' - ', '-', '-'], $value);
        $value = $this->cleanResumeSnippet($value);
        $value = preg_replace('/^(?:work\s+experience|professional\s+experience|employment|employment\s+history|work\s+history|experience)\s*:?\s*/i', '', $value);
        $value = preg_replace('/\b(?:work\s+experience|professional\s+experience|employment\s+history|work\s+history)\b\s*:?\s*/i', '', (string) $value);
        $value = preg_replace('/\b(?:education|educational\s+background|academic\s+background|skills?|projects?|certifications?|certification|references?|contact|personal\s+information)\b.*$/i', '', (string) $value);
        $value = preg_replace('/\s*[-|]\s*$/', '', (string) $value);
        $value = preg_replace('/\b(\d+)\s+years?\s+experience\b/i', '$1 years experience', (string) $value);
        $value = preg_replace(
            '/^([A-Z][A-Za-z\/+.#\s-]{2,80}?)\s+((?:[A-Z]{2,}|[A-Z][A-Za-z]+)(?:\s+(?:Industry|Department|Division|Office|Unit|Services?|Technologies|Solutions|Company|Corporation|Inc\.?))?)\s+(\d+\s+years?\s+experience)$/i',
            '$1 - $2 - $3',
            (string) $value
        );

        return $this->cleanDanglingWords($this->cleanResumeSnippet((string) $value));
    }

    private function isUsefulExperienceEntry(string $entry): bool
    {
        $entry = trim($entry);
        if ($entry === '' || mb_strlen($entry) < 8) {
            return false;
        }

        if (preg_match('/^(?:work\s+experience|professional\s+experience|employment|experience)$/i', $entry)) {
            return false;
        }

        if (preg_match('/\b(?:email|phone|address|birth|civil status|nationality|references available)\b/i', $entry)) {
            return false;
        }

        return preg_match('/\b(?:engineer|developer|analyst|manager|lead|specialist|consultant|intern|assistant|architect|administrator|officer|designer|coordinator|supervisor|teacher|instructor|clerk|staff|experience|years?|present|current|designed|developed|translated|ensured|managed|created|built|implemented|optimized|integrated|collaborated|maintained|supported|handled|prepared|assisted|led|trained|tested|deployed)\b/i', $entry) === 1;
    }

    private function splitExperienceEntry(string $entry): array
    {
        $entry = $this->cleanExperienceEntry($entry);
        if ($entry === '') {
            return [];
        }

        if (preg_match('/\b\d+\s+years?\s+experience\b/i', $entry) && preg_match('/\b(?:engineer|developer|analyst|manager|lead|specialist|consultant|intern|assistant|architect|administrator|officer|designer|coordinator|supervisor|teacher|instructor|clerk|staff)\b/i', $entry)) {
            return [$entry];
        }

        $entry = preg_replace('/\s+(?=-\s+[A-Z])/', ' ', (string) $entry);
        $parts = preg_split('/(?:\s+-\s+|;\s+|(?<=\.)\s+(?=[A-Z]))/', (string) $entry) ?: [];
        $cleaned = [];
        foreach ($parts as $part) {
            $part = $this->cleanExperienceEntry($part);
            if (!$this->isUsefulExperienceEntry($part)) {
                continue;
            }
            $cleaned[] = Str::limit($part, 220, '');
        }

        return $cleaned ?: [$entry];
    }

    private function extractResumeSectionLines(string $text, array $startHeaders, array $stopHeaders): array
    {
        $lines = array_values(array_filter(array_map(
            fn ($line) => trim(preg_replace('/\s+/u', ' ', (string) $line)),
            preg_split("/\r\n|\r|\n/", str_replace("\t", ' ', $text)) ?: []
        )));

        if (!$lines) {
            return [];
        }

        $startPattern = '/^(?:' . implode('|', array_map(fn ($header) => preg_quote($header, '/'), $startHeaders)) . ')\s*:?\s*$/i';
        $inlineStartPattern = '/\b(?:' . implode('|', array_map(fn ($header) => preg_quote($header, '/'), $startHeaders)) . ')\b\s*:?\s*/i';
        $stopPattern = '/^(?:' . implode('|', array_map(fn ($header) => preg_quote($header, '/'), $stopHeaders)) . ')\s*:?\s*$/i';
        $inlineStopPattern = '/\b(?:' . implode('|', array_map(fn ($header) => preg_quote($header, '/'), $stopHeaders)) . ')\b\s*:?\s*/i';

        $section = [];
        $capturing = false;
        foreach ($lines as $line) {
            if (preg_match($startPattern, $line)) {
                $capturing = true;
                continue;
            }

            if (!$capturing && preg_match($inlineStartPattern, $line)) {
                $capturing = true;
                $line = trim((string) preg_replace($inlineStartPattern, '', $line, 1));
                if ($line === '') {
                    continue;
                }
            }

            if (!$capturing) {
                continue;
            }

            if (preg_match($stopPattern, $line)) {
                break;
            }

            if (preg_match($inlineStopPattern, $line, $match, PREG_OFFSET_CAPTURE)) {
                $line = trim(substr($line, 0, (int) $match[0][1]));
                if ($line === '') {
                    break;
                }
                $section[] = $line;
                break;
            }

            $section[] = $line;
        }

        return $section;
    }

    private function extractEducationLines(string $text): array
    {
        $sectionBlock = $this->extractSectionBlock($text, [
            'education',
            'educational background',
            'academic background',
            'academic history',
            'qualifications',
            'studies',
            'study',
            'schooling',
            'training',
        ], [
            'work experience',
            'professional experience',
            'employment',
            'employment history',
            'work history',
            'skills',
            'skill',
            'projects',
            'project',
            'certifications',
            'certification',
            'summary',
            'profile',
            'references',
            'reference',
        ]);

        $normalized = str_replace("\r", "\n", $sectionBlock !== '' ? $sectionBlock : $text);
        $lines = array_values(array_filter(array_map(
            fn ($line) => trim(preg_replace('/\s+/u', ' ', (string) $line)),
            preg_split("/\n+/", $normalized) ?: []
        )));

        $educationHeaderPattern = '/^(education|educational\s+background|academic\s+background|academic\s+history|qualifications?|studies?|study|schooling|training)\s*:?\s*$/i';
        $stopHeaderPattern = '/^(work\s+experience|professional\s+experience|employment|employment\s+history|work\s+history|skills?|projects?|certifications?|summary|profile|references)\s*:?\s*$/i';
        $degreePattern = '/\b(?:ph\.?d\.?|doctor(?:ate)?|master(?:\'s)?|mba|m\.?s\.?|msc|m\.?a\.?|bachelor(?:\'s)?|b\.?s\.?|b\.?a\.?|associate(?:\'s)?|diploma|certificate|degree|course|major|program|programming)\b/i';
        $institutionPattern = '/\b(?:university|college|institute|academy|school|polytechnic|seminary|technical\s+college|state\s+university|senior\s+high\s+school|high\s+school|elementary)\b/i';
        $studyPattern = '/\b(?:study|studies|studied|studying|student|academic|educational|enrolled|graduated|graduation|curriculum|coursework|course\s+of\s+study|major|minor|faculty|department|tuition|training|scholarship)\b/i';
        $yearPattern = '/\b(?:19|20)\d{2}\b/';
        $dateRangePattern = '/\b(?:19|20)\d{2}\s*(?:-|–|to)\s*(?:present|current|now|(?:19|20)\d{2})\b/i';
        $ignorePattern = '/\b(?:date of birth|place of birth|gender|civil status|address|parent\/guardian|email|phone|contact|personal data|name)\b/i';

        $sectionLines = [];
        $inEducationSection = false;
        foreach ($lines as $line) {
            if (preg_match($educationHeaderPattern, $line)) {
                $inEducationSection = true;
                continue;
            }

            if (preg_match($stopHeaderPattern, $line)) {
                $inEducationSection = false;
                continue;
            }

            if ($inEducationSection) {
                $sectionLines[] = $line;
            }
        }

        $pool = $sectionLines ?: $lines;
        $results = [];
        $seen = [];
        $studySignalPattern = '/\b(?:school|university|college|institute|academy|education|educational|academic|stud(?:y|ies|ied|ying)|course|major|program|training|scholarship|curriculum|enrolled|graduated|degree|diploma|certificate|high school|elementary)\b/i';
        $stopWordsPattern = '/\b(?:work\s+experience|professional\s+experience|employment|skills?|projects?|certifications?|summary|profile|references|contact|address|phone|email)\b/i';

        for ($i = 0; $i < count($pool); $i++) {
            $line = $pool[$i];
            if ($line === '') {
                continue;
            }

            if (preg_match($ignorePattern, $line)) {
                continue;
            }

            $hasEducationSignal = preg_match($institutionPattern, $line)
                || preg_match($degreePattern, $line)
                || preg_match($studyPattern, $line)
                || preg_match($dateRangePattern, $line)
                || preg_match($yearPattern, $line);

            if (!$hasEducationSignal) {
                continue;
            }

            $entry = $line;
            $next = $pool[$i + 1] ?? null;
            $nextNext = $pool[$i + 2] ?? null;

            if ($next && preg_match($institutionPattern, $line) && (preg_match($degreePattern, $next) || preg_match($studyPattern, $next))) {
                $entry = $line . ' | ' . $next;
                if ($nextNext && (preg_match($yearPattern, $nextNext) || preg_match($dateRangePattern, $nextNext))) {
                    $entry .= ' | ' . $nextNext;
                    $i += 2;
                } else {
                    $i += 1;
                }
            } elseif ($next && (preg_match($degreePattern, $line) || preg_match($studyPattern, $line)) && preg_match($institutionPattern, $next)) {
                $entry = $line . ' | ' . $next;
                if ($nextNext && (preg_match($yearPattern, $nextNext) || preg_match($dateRangePattern, $nextNext))) {
                    $entry .= ' | ' . $nextNext;
                    $i += 2;
                } else {
                    $i += 1;
                }
            }

            if (strlen($entry) > 240) {
                $matchPattern = '/\b(?:school|university|college|institute|academy|education|educational|academic|study|studies|studied|studying|course|major|program|training|scholarship|degree|diploma|certificate|high school|elementary)\b/i';
                if (preg_match($matchPattern, $entry, $match, PREG_OFFSET_CAPTURE)) {
                    $offset = max(0, (int) $match[0][1] - 60);
                    $entry = substr($entry, $offset, 240);
                } else {
                    $entry = substr($entry, 0, 240);
                }
            }

            $entry = trim(preg_replace('/\s+/u', ' ', $entry));
            $entry = preg_replace('/\b(?:work\s+experience|professional\s+experience|employment|skills?|projects?|certifications?|summary|profile|references|contact|address|phone|email).*$/i', '', $entry);
            $this->addUniqueEntries($results, $seen, $this->splitEducationEntry((string) $entry), 6);

            if (count($results) >= 6) {
                break;
            }
        }

        if (!$results) {
            for ($i = 0; $i < count($pool); $i++) {
                $line = $pool[$i];
                if ($line === '' || !preg_match($studySignalPattern, $line)) {
                    continue;
                }

                if (preg_match($ignorePattern, $line)) {
                    continue;
                }

                $entryParts = [$line];
                $prev = $pool[$i - 1] ?? null;
                $next = $pool[$i + 1] ?? null;
                $nextNext = $pool[$i + 2] ?? null;

                foreach ([$prev, $next, $nextNext] as $neighbor) {
                    if (!$neighbor) {
                        continue;
                    }

                    $neighborLooksRelevant = preg_match($institutionPattern, $neighbor)
                        || preg_match($degreePattern, $neighbor)
                        || preg_match($yearPattern, $neighbor)
                        || preg_match($dateRangePattern, $neighbor)
                        || preg_match($studyPattern, $neighbor);

                    if ($neighborLooksRelevant && !in_array($neighbor, $entryParts, true)) {
                        $entryParts[] = $neighbor;
                    }
                }

                $entry = implode(' | ', array_slice($entryParts, 0, 4));
                if (strlen($entry) > 240) {
                    $entry = substr($entry, 0, 240);
                }
                $entry = trim(preg_replace('/\s+/u', ' ', $entry));
                $entry = preg_replace('/\b(?:work\s+experience|professional\s+experience|employment|skills?|projects?|certifications?|summary|profile|references|contact|address|phone|email).*$/i', '', $entry);
                $this->addUniqueEntries($results, $seen, $this->splitEducationEntry((string) $entry), 6);

                if (count($results) >= 6) {
                    break;
                }
            }
        }

        if ($results) {
            return $results;
        }

        $compact = preg_replace('/\s+/u', ' ', $normalized);
        preg_match_all('/(?:education|educational background|academic background|academic history|qualifications?|studies?|training)[^|]{0,120}/i', $compact, $sectionMatches);
        if (!empty($sectionMatches[0])) {
            $fallback = array_values(array_filter(array_map('trim', $sectionMatches[0])));
            if ($fallback) {
                $cleanedFallback = [];
                $fallbackSeen = [];
                foreach (array_slice($fallback, 0, 6) as $line) {
                    $this->addUniqueEntries($cleanedFallback, $fallbackSeen, $this->splitEducationEntry((string) $line), 6);
                }

                return $cleanedFallback;
            }
        }

        preg_match_all('/(?:university|college|institute|academy|school|high school|elementary|ph\.?d\.?|doctor(?:ate)?|master(?:\'s)?|mba|m\.?s\.?|msc|m\.?a\.?|bachelor(?:\'s)?|b\.?s\.?|b\.?a\.?|associate(?:\'s)?|diploma|certificate|course|major|program|stud(?:y|ies|ied|ying))[^\|]{0,100}/i', $compact, $matches);
        $fallbackResults = [];
        $fallbackSeen = [];
        foreach (array_values(array_filter(array_map('trim', $matches[0] ?? []))) as $line) {
            $this->addUniqueEntries($fallbackResults, $fallbackSeen, $this->splitEducationEntry((string) $line), 6);
        }

        return $fallbackResults;
    }

    private function extractExperienceLines(string $text): array
    {
        $startHeaders = [
            'work experience',
            'professional experience',
            'employment',
            'employment history',
            'work history',
            'experience',
        ];
        $stopHeaders = [
            'education',
            'educational background',
            'academic background',
            'academic history',
            'qualifications',
            'studies',
            'study',
            'schooling',
            'training',
            'skills',
            'skill',
            'projects',
            'project',
            'certifications',
            'certification',
            'summary',
            'profile',
            'references',
            'reference',
            'contact',
            'personal information',
        ];

        $sectionLines = $this->extractResumeSectionLines($text, $startHeaders, $stopHeaders);
        $sectionBlock = $sectionLines
            ? implode("\n", $sectionLines)
            : $this->extractSectionBlock($text, $startHeaders, $stopHeaders);

        $normalized = str_replace(
            ["\r", "\t", "\u{2022}", "\u{25CF}", "\u{25AA}", "\u{2013}", "\u{2014}"],
            ["\n", ' ', "\n- ", "\n- ", "\n- ", '-', '-'],
            $sectionBlock !== '' ? $sectionBlock : $text
        );
        $normalized = preg_replace('/\s+-\s+(?=[A-Z])/', "\n- ", (string) $normalized);
        $normalized = preg_replace('/(?<!^)\b(?:work\s+experience|professional\s+experience|employment\s+history|work\s+history)\b\s*:?\s*/i', "\n", (string) $normalized);

        $lines = array_values(array_filter(array_map(
            fn ($line) => $this->cleanExperienceEntry((string) $line),
            preg_split("/\n+/", (string) $normalized) ?: []
        )));

        $results = [];
        $seen = [];
        foreach ($lines as $line) {
            if ($this->isUsefulExperienceEntry($line)) {
                $this->addUniqueEntries($results, $seen, $this->splitExperienceEntry((string) $line), 8);
            }

            if (count($results) >= 8) {
                break;
            }
        }

        if (!$results && $sectionBlock !== '') {
            $this->addUniqueEntries($results, $seen, $this->splitExperienceEntry($sectionBlock), 8);
        }

        return array_slice($results, 0, 8);
    }

    private function normalizeWhitespace(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', $text));
    }

    private function extractSectionBlock(string $text, array $startHeaders, array $stopHeaders): string
    {
        $normalized = trim(preg_replace('/\s+/u', ' ', str_replace(["\r", "\n", "\t"], ' ', $text)));
        if ($normalized === '') {
            return '';
        }

        $lower = Str::lower($normalized);
        $startOffset = null;
        foreach ($startHeaders as $header) {
            $pos = strpos($lower, Str::lower($header));
            if ($pos === false) {
                continue;
            }
            if ($startOffset === null || $pos < $startOffset) {
                $startOffset = $pos;
            }
        }

        if ($startOffset === null) {
            return '';
        }

        $endOffset = null;
        foreach ($stopHeaders as $header) {
            $pos = strpos($lower, Str::lower($header), $startOffset + 1);
            if ($pos === false) {
                continue;
            }
            if ($endOffset === null || $pos < $endOffset) {
                $endOffset = $pos;
            }
        }

        $section = $endOffset !== null && $endOffset > $startOffset
            ? substr($normalized, $startOffset, $endOffset - $startOffset)
            : substr($normalized, $startOffset);

        return trim((string) $section);
    }
}
