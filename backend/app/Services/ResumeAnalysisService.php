<?php

namespace App\Services;

use App\Models\GlobalSkillCatalog;
use App\Models\Job;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class ResumeAnalysisService
{
    public function __construct(
        private readonly TextExtractionService $textExtractionService
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
        $globalSkills = GlobalSkillCatalog::query()->pluck('skill')->all();

        $job = null;
        if ($appliedJobTitle !== '') {
            $job = Job::query()
                ->whereRaw('LOWER(title) = ?', [Str::lower(trim($appliedJobTitle))])
                ->first();
        }

        $requiredSkills = $this->splitSkills($job?->required_skills ?? '');
        if (!$requiredSkills) {
            $requiredSkills = $this->buildSkillSuggestions($resumeText, $globalSkills);
        }

        $matchedSkills = $this->findMatchedSkills($resumeText, $requiredSkills ?: $globalSkills);
        $missingSkills = array_values(array_diff($requiredSkills, $matchedSkills));

        $skillsScore = $this->calculateSkillsScore($requiredSkills, $matchedSkills);
        $projectScore = $this->calculateProjectScore($resumeText);
        $educationLines = $this->extractEducationLines($extractedText);
        $experienceLines = $this->extractExperienceLines($extractedText);

        $minimumEducation = (string) ($job?->minimum_education ?? '');
        $minimumExperienceYears = (int) ($job?->minimum_experience_years ?? 0);
        $educationScore = $this->calculateEducationScore($educationLines, $minimumEducation);
        $experienceScore = $this->calculateExperienceScore($experienceLines, $minimumExperienceYears);
        $overall = round(($skillsScore * 0.55) + ($experienceScore * 0.2) + ($educationScore * 0.15) + ($projectScore * 0.1), 2);

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
            'preview_text' => Str::limit($resumeText, 1000, ''),
            'matched_job_title' => $job?->title ?: ($appliedJobTitle !== '' ? $appliedJobTitle : null),
        ];
    }

    public function matchJobs(string $resumeText, iterable $jobs): array
    {
        $globalSkills = GlobalSkillCatalog::query()->pluck('skill')->all();
        $resumeText = $this->normalizeWhitespace($resumeText);
        $results = [];

        foreach ($jobs as $job) {
            $requiredSkills = $this->splitSkills((string) Arr::get((array) $job, 'requiredSkills', Arr::get((array) $job, 'required_skills', '')));
            if (!$requiredSkills) {
                $requiredSkills = $this->buildSkillSuggestions($resumeText, $globalSkills);
            }

            $matchedSkills = $this->findMatchedSkills($resumeText, $requiredSkills ?: $globalSkills);
            $missingSkills = array_values(array_diff($requiredSkills, $matchedSkills));
            $skillsScore = $this->calculateSkillsScore($requiredSkills, $matchedSkills);
            $projectScore = $this->calculateProjectScore($resumeText);
            $educationScore = $this->calculateEducationScore(
                $this->extractEducationLines($resumeText),
                (string) Arr::get((array) $job, 'minimumEducation', Arr::get((array) $job, 'minimum_education', ''))
            );
            $experienceScore = $this->calculateExperienceScore(
                $this->extractExperienceLines($resumeText),
                (int) Arr::get((array) $job, 'minimumExperienceYears', Arr::get((array) $job, 'minimum_experience_years', 0))
            );
            $overall = round(($skillsScore * 0.55) + ($experienceScore * 0.2) + ($educationScore * 0.15) + ($projectScore * 0.1), 2);

            $results[] = [
                'id' => Arr::get((array) $job, 'id'),
                'title' => Arr::get((array) $job, 'title'),
                'description' => Arr::get((array) $job, 'description'),
                'status' => Arr::get((array) $job, 'status', 'active'),
                'department' => Arr::get((array) $job, 'department'),
                'location' => Arr::get((array) $job, 'location'),
                'type' => Arr::get((array) $job, 'type'),
                'requiredSkills' => implode(', ', $requiredSkills),
                'minimumEducation' => Arr::get((array) $job, 'minimumEducation', Arr::get((array) $job, 'minimum_education', '')),
                'minimumExperienceYears' => Arr::get((array) $job, 'minimumExperienceYears', Arr::get((array) $job, 'minimum_experience_years', 0)),
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
            $entry = trim((string) $entry, " \t\n\r\0\x0B-|");

            $normalizedEntry = Str::lower($entry);
            if (!isset($seen[$normalizedEntry])) {
                $seen[$normalizedEntry] = true;
                $results[] = $entry;
            }

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
                $entry = trim((string) $entry, " \t\n\r\0\x0B-|");
                $normalizedEntry = Str::lower($entry);
                if (!isset($seen[$normalizedEntry])) {
                    $seen[$normalizedEntry] = true;
                    $results[] = $entry;
                }

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
                return array_slice(array_map(
                    fn ($line) => trim(preg_replace('/\s+/u', ' ', (string) $line)),
                    array_slice($fallback, 0, 6)
                ), 0, 6);
            }
        }

        preg_match_all('/(?:university|college|institute|academy|school|high school|elementary|ph\.?d\.?|doctor(?:ate)?|master(?:\'s)?|mba|m\.?s\.?|msc|m\.?a\.?|bachelor(?:\'s)?|b\.?s\.?|b\.?a\.?|associate(?:\'s)?|diploma|certificate|course|major|program|stud(?:y|ies|ied|ying))[^\|]{0,100}/i', $compact, $matches);
        return array_slice(array_values(array_filter(array_map('trim', $matches[0] ?? []))), 0, 6);
    }

    private function extractExperienceLines(string $text): array
    {
        $sectionBlock = $this->extractSectionBlock($text, [
            'work experience',
            'professional experience',
            'employment',
            'employment history',
            'work history',
        ], [
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
        ]);

        $normalized = str_replace("\r", "\n", $sectionBlock !== '' ? $sectionBlock : $text);
        $lines = array_values(array_filter(array_map(
            'trim',
            preg_split("/\n+/", $normalized) ?: []
        )));

        $results = [];
        foreach ($lines as $line) {
            if (preg_match('/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*(?:-|to|–)\s*(?:present|current|now|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|\d{4})\b/i', $line)
                || preg_match('/\b(?:engineer|developer|analyst|manager|lead|specialist|consultant|intern|assistant|architect|administrator|officer|designer)\b/i', $line)
                || preg_match('/\b(?:at|with)\s+[A-Z][A-Za-z0-9&.,\- ]{1,80}\b/', $line)
            ) {
                $results[] = $line;
            }
        }

        return array_slice(array_values(array_unique($results)), 0, 8);
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
