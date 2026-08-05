<?php

namespace App\Services;

use Illuminate\Support\Str;

class PdsExtractionService
{
    public function format(string $text): array
    {
        $lines = $this->lines($text);
        $joined = $this->compact($text);
        $nameParts = $this->extractNameParts($lines);
        $personalInformation = [
            'surname' => $nameParts['surname'] ?? $this->field($lines, $joined, ['surname', 'last name']),
            'first_name' => $nameParts['first_name'] ?? $this->field($lines, $joined, ['first name', 'first name/s', 'given name']),
            'middle_name' => $nameParts['middle_name'] ?? $this->field($lines, $joined, ['middle name']),
        ];
        $educationEntries = $this->extractEducationEntries($lines, $joined);
        $education = array_values(array_filter(array_map(
            fn ($entry) => $entry['summary'] ?? '',
            $educationEntries
        )));
        $experienceEntries = $this->extractExperienceEntries($lines, $joined);
        $experience = array_values(array_filter(array_map(
            fn ($entry) => $entry['summary'] ?? '',
            $experienceEntries
        )));
        $skills = $this->extractSkills($lines, $joined, $education, $experience);
        $matchingFields = [
            'skills' => $skills,
            'education' => $education,
            'experience' => $experience,
        ];

        return [
            'detected' => $this->looksLikePds($joined),
            'confidence' => $this->confidence($lines, $joined),
            'name' => $this->fullName($personalInformation),
            'personal_information' => $personalInformation,
            'skills' => $skills,
            'education' => $education,
            'education_entries' => $educationEntries,
            'experience' => $experience,
            'experience_entries' => $experienceEntries,
            'matching_fields' => $matchingFields,
            'matching_text' => $this->buildMatchingText($matchingFields),
        ];
    }

    private function looksLikePds(string $text): bool
    {
        $lower = Str::lower($text);

        return Str::contains($lower, 'personal data sheet')
            || Str::contains($lower, 'cs form no. 212')
            || (Str::contains($lower, 'civil service commission') && Str::contains($lower, 'personal information'));
    }

    private function lines(string $text): array
    {
        return array_values(array_filter(array_map(
            fn ($line) => trim((string) preg_replace('/[^\S\r\n]/u', ' ', (string) $line)),
            preg_split("/\r\n|\r|\n/", str_replace("\t", '    ', $text)) ?: []
        )));
    }

    private function compact(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', str_replace(["\r", "\n", "\t"], ' ', $text)));
    }

    private function confidence(array $lines, string $text): string
    {
        $signals = 0;
        $lower = Str::lower($text);
        foreach (['personal data sheet', 'cs form no. 212', 'personal information', 'educational background', 'civil service eligibility', 'work experience'] as $signal) {
            if (Str::contains($lower, $signal)) {
                $signals++;
            }
        }
        $signals += count($lines) >= 20 ? 1 : 0;

        return $signals >= 5 ? 'high' : ($signals >= 3 ? 'medium' : 'low');
    }

    private function fullName(array $personalInformation): ?string
    {
        $parts = array_filter([
            $personalInformation['first_name'] ?? null,
            $personalInformation['middle_name'] ?? null,
            $personalInformation['surname'] ?? null,
        ]);

        return $parts ? implode(' ', $parts) : null;
    }

    private function extractSkills(array $lines, string $text, array $education = [], array $experience = []): array
    {
        $skillRows = $this->extractRows($this->section($lines, [
            'special skills and hobbies',
            'skills and hobbies',
            'special skills',
            'other information',
        ], [
            'learning and development',
            'training programs',
            'number of hours',
            'conducted',
            'sponsored by',
            'references',
            'questionnaire',
            'signature',
        ]), 20);
        $skillRows = array_values(array_filter(array_map(
            fn ($row) => $this->normalizeSkillCandidate((string) $row),
            $skillRows
        ), fn ($row) => $this->isUsefulSkillValue((string) $row)));

        $knownSkills = [
            'administration',
            'accounting',
            'bookkeeping',
            'clerical',
            'communication',
            'computer literacy',
            'customer service',
            'data encoding',
            'data management',
            'documentation',
            'filing',
            'human resources',
            'leadership',
            'management',
            'microsoft excel',
            'microsoft office',
            'microsoft powerpoint',
            'microsoft word',
            'office administration',
            'organization',
            'planning',
            'procurement',
            'problem solving',
            'records management',
            'report writing',
            'research',
            'scheduling',
            'teaching',
            'teamwork',
            'time management',
            'typing',
            'training',
        ];

        $found = [];
        $focusedText = trim(implode(' ', array_filter(array_merge($skillRows, $education, $experience))));
        $lower = Str::lower($focusedText !== '' ? $focusedText : implode(' ', $skillRows));
        foreach ($knownSkills as $skill) {
            if ($this->containsPhrase($lower, $skill)) {
                $found[] = Str::title($skill);
            }
        }

        foreach ($skillRows as $row) {
            $parts = preg_split('/[,;|\/]+/', $row) ?: [];
            foreach ($parts as $part) {
                $part = $this->normalizeSkillCandidate((string) $part);
                if ($this->isUsefulSkillValue($part)) {
                    $found[] = $this->formatSkillLabel($part);
                }
            }
        }

        return $this->uniqueSkills($found);
    }

    private function buildMatchingText(array $matchingFields): string
    {
        $sections = [];
        $skills = $this->uniqueRows($matchingFields['skills'] ?? []);
        $education = $this->uniqueRows($matchingFields['education'] ?? []);
        $experience = $this->uniqueRows($matchingFields['experience'] ?? []);

        if ($skills) {
            $sections[] = 'Skills: ' . implode(', ', array_slice($skills, 0, 20)) . '.';
        }
        if ($education) {
            $sections[] = 'Education: ' . implode(' | ', array_slice($education, 0, 8)) . '.';
        }
        if ($experience) {
            $sections[] = 'Experience: ' . implode(' | ', array_slice($experience, 0, 10)) . '.';
        }

        return trim(preg_replace('/\s+/u', ' ', implode(' ', $sections)));
    }

    private function containsPhrase(string $text, string $phrase): bool
    {
        $phrase = trim($phrase);
        if ($phrase === '') {
            return false;
        }

        return preg_match('/(?<![a-z0-9])' . preg_quote($phrase, '/') . '(?![a-z0-9])/i', $text) === 1;
    }

    private function isUsefulSkillValue(string $value): bool
    {
        $value = $this->normalizeSkillCandidate($value);
        if ($value === '' || mb_strlen($value) < 3 || mb_strlen($value) > 80) {
            return false;
        }

        if ($this->looksLikeLabelOnly($value) || $this->isPdsTableHeaderRemainder($value)) {
            return false;
        }

        if (preg_match('/^(?:and hobbies|special skills(?: and hobbies)?|non-academic distinctions?|recognition|membership in association\/?organization|other information)$/i', $value)) {
            return false;
        }

        if (preg_match('/^(?:[ivxlcdm]+|page\s+\d+\s+of\s+\d+|date(?:\s+\S+){0,4}|from|to|conducted|sponsored by|number of hours)$/i', $value)) {
            return false;
        }

        if (preg_match('/\b(?:cs\s*form|page\s+\d+\s+of\s+\d+|number of hours|conducted|sponsored by|learning and development|training programs?|title of learning|type of ld|inclusive dates|non-academic distinctions?|membership in association|questionnaire|signature|date accomplished|right thumbmark|government issued|person administering oath)\b/i', $value)) {
            return false;
        }

        if (preg_match('/^(?:reading(?:\s+books?)?|watching(?:\s+movies?)?|listening\s+to\s+music|playing(?:\s+\w+)?|singing|dancing|cooking|travell?ing|sports?)$/i', $value)) {
            return false;
        }

        return preg_match('/[a-z]/i', $value) === 1;
    }

    private function normalizeSkillCandidate(string $value): string
    {
        $value = $this->cleanValue($value);
        $value = preg_replace('/\bcs\s*form(?:\s+no\.?)?\s*212\b/i', ' ', (string) $value);
        $value = preg_replace('/\bpage\s+\d+\s+of\s+\d+\b/i', ' ', (string) $value);
        $value = preg_replace('/\bdate\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s+\d{2,4})?\b/i', ' ', (string) $value);
        $value = preg_replace('/^a(?=reading\s+books?\b)/i', '', (string) $value);
        $value = preg_replace('/^(?:[a-z]|[ivxlcdm]+|\d+)\s*[\.\)]\s*/i', '', (string) $value);
        $value = preg_replace('/\s+/u', ' ', (string) $value);

        return trim((string) $value, " \t\n\r\0\x0B:-|.,");
    }

    private function formatSkillLabel(string $value): string
    {
        $value = $this->normalizeSkillCandidate($value);
        if ($value === '') {
            return '';
        }

        if (mb_strtoupper($value) === $value) {
            $value = Str::title(Str::lower($value));
            $value = preg_replace_callback('/\b(?:Of|And|In|For|The|At|On)\b/', fn ($match) => Str::lower($match[0]), $value);
        }

        $value = preg_replace_callback('/\b(?:php|html|css|api|ui|ux|hr|it|ict|ms)\b/i', fn ($match) => mb_strtoupper($match[0]), $value);

        return trim((string) preg_replace('/\s+/u', ' ', (string) $value));
    }

    private function uniqueSkills(array $skills): array
    {
        $seen = [];
        $result = [];
        foreach ($skills as $skill) {
            $skill = $this->formatSkillLabel((string) $skill);
            if (!$this->isUsefulSkillValue($skill)) {
                continue;
            }

            $key = Str::lower($skill);
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $result[] = $skill;
        }

        return $this->removeRedundantSkillLabels($result);
    }

    private function removeRedundantSkillLabels(array $skills): array
    {
        $genericSkills = ['administration', 'management'];

        return array_values(array_filter($skills, function ($skill) use ($skills, $genericSkills) {
            $normalized = Str::lower((string) $skill);
            if (!in_array($normalized, $genericSkills, true)) {
                return true;
            }

            foreach ($skills as $other) {
                $otherNormalized = Str::lower((string) $other);
                if ($otherNormalized !== $normalized && Str::contains($otherNormalized, $normalized)) {
                    return false;
                }
            }

            return true;
        }));
    }

    private function extractExperience(array $lines, string $text): array
    {
        return array_values(array_filter(array_map(
            fn ($entry) => $entry['summary'] ?? '',
            $this->extractExperienceEntries($lines, $text)
        )));
    }

    private function extractExperienceEntries(array $lines, string $text): array
    {
        $sectionLines = $this->section($lines, ['work experience'], ['voluntary work', 'learning and development', 'training programs', 'special skills', 'other information', 'references', 'questionnaire']);
        $rows = $this->extractRows($this->cleanPdsTableLines($sectionLines), 20);
        $rows = array_values(array_filter($rows, fn ($row) => $this->formatExperienceRow((string) $row) !== ''));

        if (!$rows && preg_match('/\bwork experience\b\s*(.*?)(?=\b(?:voluntary work|learning and development|training programs|special skills|other information|references|questionnaire)\b|$)/iu', $text, $match)) {
            $value = $this->cleanValue($match[1] ?? '');
            $value = $this->removePdsTableHeaders($this->trimAtNextLabel($value));
            $rows = $this->splitExperienceText($value);
        }

        $entries = [];
        foreach ($rows as $row) {
            $entry = $this->parseExperienceEntry((string) $row);
            if ($entry !== null) {
                $entries[] = $entry;
            }
        }

        return $this->uniqueEntries($entries, 'summary');
    }

    private function extractEducation(array $lines, string $text): array
    {
        return array_values(array_filter(array_map(
            fn ($entry) => $entry['summary'] ?? '',
            $this->extractEducationEntries($lines, $text)
        )));
    }

    private function extractEducationEntries(array $lines, string $text): array
    {
        $levels = [
            'elementary' => 'Elementary',
            'secondary' => 'Secondary',
            'vocational' => 'Vocational',
            'college' => 'College',
            'graduate studies' => 'Graduate Studies',
        ];

        $results = [];
        foreach ($levels as $key => $label) {
            $value = $this->extractEducationLevel($text, $key);
            if ($value === null) {
                continue;
            }
            $value = $this->removePdsTableHeaders($value);
            if ($this->isUsefulEducationValue($value)) {
                $results[] = $this->parseEducationEntry($value, $label);
            }
        }

        $sectionRows = $this->extractRows($this->cleanPdsTableLines($this->section($lines, ['educational background'], ['civil service eligibility', 'work experience'])), 16);
        foreach ($sectionRows as $row) {
            $row = $this->removePdsTableHeaders($row);
            if (!$this->isUsefulEducationValue($row) || $this->isPdsTableHeaderRemainder($row)) {
                continue;
            }

            $matchedLevel = null;
            foreach ($levels as $key => $label) {
                if (preg_match('/\b' . preg_quote($key, '/') . '\b/i', $row)) {
                    $matchedLevel = $label;
                    $row = trim((string) preg_replace('/\b' . preg_quote($key, '/') . '\b\s*:?\s*/i', '', $row, 1));
                    break;
                }
            }

            $results[] = $this->parseEducationEntry($row, $matchedLevel);
        }

        $results = $this->enrichEducationEntriesFromPdsColumns(array_values(array_filter($results)), $lines);

        return $this->uniqueEducationEntries($results);
    }

    private function field(array $lines, string $joined, array $labels): ?string
    {
        foreach ($labels as $label) {
            $value = $this->valueFromLines($lines, $label);
            if ($value !== null) {
                return $value;
            }
        }

        return $this->valueAfterLabel($joined, $labels);
    }

    private function valueFromLines(array $lines, string $label): ?string
    {
        $labelPattern = $this->labelPattern($label);

        foreach ($lines as $index => $line) {
            if (!preg_match($labelPattern, $line, $match, PREG_OFFSET_CAPTURE)) {
                continue;
            }

            $after = trim(substr($line, (int) $match[0][1] + strlen($match[0][0])));
            $after = preg_replace('/^(?:\:|\-|\.|\)|\s)+/', '', (string) $after);
            $after = $this->cleanValue((string) $after);
            $after = $this->trimAtNextLabel($after);
            if ($this->isLikelyFieldValue($after) && !$this->looksLikeLabelOnly($after)) {
                return $after;
            }

            foreach (array_slice($lines, $index + 1, 3) as $nearby) {
                $nearby = $this->cleanValue((string) $nearby);
                if ($this->isLikelyFieldValue($nearby) && !$this->looksLikeLabelOnly($nearby) && !$this->isRejectedNameValue($nearby)) {
                    return $nearby;
                }
            }
        }

        return null;
    }

    private function labelPattern(string $label): string
    {
        $label = preg_quote($label, '/');
        $label = str_replace('\ ', '\s+', $label);

        return '/^(?:\d+\s*[\.\)]\s*)?(?:[a-z]\.\s*)?' . $label . '\b|(?:\b' . $label . '\b\s*(?::|-|_|\s{2,}))/iu';
    }

    private function extractNameParts(array $lines): array
    {
        foreach ($lines as $index => $line) {
            $lower = Str::lower($line);
            if (!Str::contains($lower, 'surname') || !Str::contains($lower, 'first name') || !Str::contains($lower, 'middle name')) {
                continue;
            }

            foreach (array_slice($lines, $index + 1, 4) as $candidate) {
                $candidate = $this->cleanValue((string) $candidate);
                if (!$this->isLikelyFieldValue($candidate) || $this->looksLikeLabelOnly($candidate) || $this->isRejectedNameValue($candidate)) {
                    continue;
                }

                $parts = preg_split('/\s{2,}|\s+\|\s+/', $candidate) ?: [];
                $parts = array_values(array_filter(array_map(fn ($part) => $this->cleanValue((string) $part), $parts)));
                if (count($parts) >= 3) {
                    return [
                        'surname' => $parts[0],
                        'first_name' => $parts[1],
                        'middle_name' => $parts[2],
                    ];
                }

                $wordParts = preg_split('/\s+/', $candidate) ?: [];
                $wordParts = array_values(array_filter(array_map('trim', $wordParts)));
                if (count($wordParts) >= 3) {
                    $surnameWordCount = $this->surnameWordCount($wordParts);
                    $surname = implode(' ', array_slice($wordParts, 0, $surnameWordCount));
                    $firstName = $wordParts[$surnameWordCount] ?? null;
                    $middleName = implode(' ', array_slice($wordParts, $surnameWordCount + 1));

                    if ($surname && $firstName) {
                        return [
                            'surname' => $surname,
                            'first_name' => $firstName,
                            'middle_name' => $middleName ?: null,
                        ];
                    }
                }
            }
        }

        return [];
    }

    private function surnameWordCount(array $words): int
    {
        $first = Str::lower($words[0] ?? '');
        $second = Str::lower($words[1] ?? '');

        if ($first === 'de' && $second === 'la') {
            return min(3, count($words) - 1);
        }

        if (in_array($first, ['de', 'del', 'dela', 'van', 'von'], true)) {
            return min(2, count($words) - 1);
        }

        return 1;
    }

    private function valueAfterLabel(string $text, array $labels): ?string
    {
        $stopPattern = implode('|', array_map(fn ($item) => preg_quote($item, '/'), $this->stopLabels()));

        foreach ($labels as $label) {
            $pattern = '/\b' . preg_quote($label, '/') . '\b\s*(?::|-)?\s*(.*?)(?=\s+\b(?:' . $stopPattern . ')\b\s*(?::|-)?|$)/iu';
            if (!preg_match($pattern, $text, $match)) {
                continue;
            }

            $value = $this->cleanValue($match[1] ?? '');
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function extractEducationLevel(string $text, string $level): ?string
    {
        $nextLevels = [
            'elementary',
            'secondary',
            'vocational',
            'college',
            'graduate studies',
            'civil service eligibility',
            'work experience',
            'special skills',
            'skills',
        ];
        $stops = array_values(array_filter($nextLevels, fn ($item) => $item !== $level));
        $pattern = '/\b' . preg_quote($level, '/') . '\b\s*(.*?)(?=\s+\b(?:' . implode('|', array_map(fn ($item) => preg_quote($item, '/'), $stops)) . ')\b|$)/iu';

        if (!preg_match($pattern, $text, $match)) {
            return null;
        }

        $value = $this->removePdsTableHeaders($this->cleanValue($match[1] ?? ''));
        return $value !== '' ? $value : null;
    }

    private function enrichEducationEntriesFromPdsColumns(array $entries, array $lines): array
    {
        $schoolMap = $this->extractPdsSchoolMap($lines);
        $courseMap = $this->extractPdsCourseMap($lines);
        $enriched = [];

        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $levelKey = $this->educationLevelKey($entry['level'] ?? null);
            if ($levelKey === null) {
                continue;
            }

            $sourceText = trim(implode(' ', array_filter([
                $entry['summary'] ?? '',
                $entry['school'] ?? '',
                $entry['degree'] ?? '',
            ])));
            $meta = $this->extractEducationMeta($sourceText);
            $school = $this->cleanEducationSchool((string) ($entry['school'] ?? ''));
            if (!$this->isLikelySchoolValue($school)) {
                $school = $schoolMap[$levelKey] ?? null;
            }

            $degree = $this->cleanEducationCourse((string) ($entry['degree'] ?? ''));
            if (!$this->isUsefulCourseValue($degree, $levelKey)) {
                $degree = $courseMap[$levelKey] ?? null;
            }

            $entry['school'] = $school ?: null;
            $entry['degree'] = $degree ?: null;
            $entry['attendance_period'] = $meta['attendance_period'];
            $entry['year_graduated'] = $entry['year_graduated'] ?: $meta['year_graduated'];
            $entry['honors'] = $meta['honors'];
            $entry['summary'] = $this->educationSummary($entry);

            if ($entry['summary'] !== '') {
                $enriched[] = $entry;
            }
        }

        return $enriched;
    }

    private function extractPdsSchoolMap(array $lines): array
    {
        $map = [];
        $count = count($lines);

        for ($i = 0; $i < $count; $i++) {
            $school = $this->cleanEducationSchool((string) $lines[$i]);
            if (!$this->isLikelySchoolValue($school)) {
                continue;
            }

            for ($j = 1; $j <= 2; $j++) {
                $next = $this->cleanEducationSchool((string) ($lines[$i + $j] ?? ''));
                if (!$this->isSchoolContinuation($school, $next)) {
                    break;
                }
                $school = trim($school . ' ' . $next);
            }

            $levelKey = $this->inferEducationLevelFromSchool($school);
            if ($levelKey !== null && empty($map[$levelKey])) {
                $map[$levelKey] = $this->formatSchoolName($school);
            }
        }

        return $map;
    }

    private function extractPdsCourseMap(array $lines): array
    {
        $map = [];

        foreach ($lines as $line) {
            $course = $this->cleanEducationCourse((string) $line);
            if ($course === '') {
                continue;
            }

            $lower = Str::lower($course);
            $levelKey = null;
            if (preg_match('/\bgrade\s*1\s*(?:-|to)\s*grade\s*6\b/i', $course)) {
                $levelKey = 'elementary';
            } elseif (preg_match('/\bgrade\s*7\s*(?:-|to)\s*grade\s*12\b/i', $course)) {
                $levelKey = 'secondary';
            } elseif (Str::contains($lower, ['ncii', 'nc ii', 'tesda', 'vocational', 'technical', 'trade course'])) {
                $levelKey = 'vocational';
            } elseif (Str::contains($lower, ['master', 'doctor', 'phd', 'graduate studies'])) {
                $levelKey = 'graduate studies';
            } elseif (Str::contains($lower, ['bachelor', 'college', 'university', 'bs ', 'ba '])) {
                $levelKey = 'college';
            }

            if ($levelKey !== null && empty($map[$levelKey]) && $this->isUsefulCourseValue($course, $levelKey)) {
                $map[$levelKey] = $this->formatEducationText($course);
            }
        }

        return $map;
    }

    private function educationLevelKey(?string $level): ?string
    {
        $level = Str::lower(trim((string) $level));
        if ($level === '') {
            return null;
        }

        return match (true) {
            Str::contains($level, 'elementary') => 'elementary',
            Str::contains($level, 'secondary') => 'secondary',
            Str::contains($level, 'vocational') => 'vocational',
            Str::contains($level, 'college') => 'college',
            Str::contains($level, 'graduate') => 'graduate studies',
            default => null,
        };
    }

    private function inferEducationLevelFromSchool(string $school): ?string
    {
        $lower = Str::lower($school);

        return match (true) {
            Str::contains($lower, 'elementary') => 'elementary',
            Str::contains($lower, ['high school', 'secondary']) => 'secondary',
            Str::contains($lower, ['vocational', 'technical', 'training center']) => 'vocational',
            Str::contains($lower, 'graduate') => 'graduate studies',
            Str::contains($lower, ['university', 'college', 'campus']) => 'college',
            default => null,
        };
    }

    private function isSchoolContinuation(string $current, string $next): bool
    {
        if ($next === '' || !$this->isLikelySchoolValue($next)) {
            return false;
        }

        return preg_match('/(?:&|-)\s*[A-Za-z ]*$/', $current) === 1
            || preg_match('/^(?:campus|branch|annex|extension)$/i', $next) === 1;
    }

    private function isLikelySchoolValue(string $value): bool
    {
        $value = $this->cleanEducationSchool($value);
        if ($value === '' || mb_strlen($value) < 5 || mb_strlen($value) > 140) {
            return false;
        }

        if (preg_match('/^(?:n\/a|elementary|secondary|vocational|college|graduate studies|level|name of school|write in full|basic education|degree course|period of attendance|highest level|year graduated|scholarship|academic honors|technical\/?etc)$/i', $value)) {
            return false;
        }

        if (preg_match('/^\d+\s+[a-z ]+$/i', $value)) {
            return false;
        }

        if (preg_match('/\b(?:barangay|province|municipality|zip code|street|house|subdivision|village|hospital|surname|first name|middle name|children|citizenship|civil status|birth|telephone|mobile|email|tin|pag-ibig|philhealth|sss|umid|signature|warning)\b/i', $value)) {
            return false;
        }

        return preg_match('/\b(?:elementary|high school|secondary|senior high|junior high|college|university|institute|academy|polytechnic|campus|technical|vocational|school)\b/i', $value) === 1;
    }

    private function cleanEducationSchool(string $value): string
    {
        $value = $this->removePdsTableHeaders($this->cleanValue($value));
        $value = $this->removeEducationMetaText($value);
        $value = preg_replace('/\b(?:grade\s*\d+\s*(?:-|to)\s*grade\s*\d+|trade course|n\/a)\b/i', ' ', (string) $value);
        $value = preg_replace('/\s+/u', ' ', (string) $value);

        return trim((string) $value, " \t\n\r\0\x0B:-|/.,");
    }

    private function cleanEducationCourse(string $value): string
    {
        $value = $this->removePdsTableHeaders($this->cleanValue($value));
        $value = $this->removeEducationMetaText($value);
        $value = preg_replace('/\b(?:n\/a|level|name of school|write in full)\b/i', ' ', (string) $value);
        $value = preg_replace('/\s+/u', ' ', (string) $value);

        return trim((string) $value, " \t\n\r\0\x0B:-|/.,");
    }

    private function isUsefulCourseValue(?string $value, ?string $levelKey = null): bool
    {
        $value = $this->cleanEducationCourse((string) $value);
        if ($value === '' || mb_strlen($value) < 4 || mb_strlen($value) > 120 || $this->looksLikeLabelOnly($value)) {
            return false;
        }

        if (preg_match('/^(?:tesda|scholar|tesda scholar|trade course|basic education|degree course)$/i', $value)) {
            return false;
        }

        if (in_array($levelKey, ['elementary', 'secondary'], true) && preg_match('/^grade\s*\d+/i', $value)) {
            return false;
        }

        return preg_match('/\b(?:bachelor|master|doctor|ph\.?d\.?|bs|ba|ma|ms|mba|course|program|degree|certificate|diploma|ncii|nc ii|tesda|education|engineering|administration|accounting|technology|computer|physical education|services)\b/i', $value) === 1;
    }

    private function extractEducationMeta(string $value): array
    {
        $value = $this->cleanValue($value);
        $attendancePeriod = null;
        if (preg_match('/\b(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:-|to)?\s*(\d{1,2}\/\d{1,2}\/\d{4})\b/i', $value, $match)) {
            $attendancePeriod = $match[1] . ' - ' . $match[2];
        }

        $yearGraduated = null;
        if (preg_match_all('/\b((?:19|20)\d{2})\b/', $value, $matches) && !empty($matches[1])) {
            $years = array_values($matches[1]);
            $yearGraduated = $years[count($years) - 1] ?? null;
        }

        $honors = [];
        if (preg_match_all('/\b(?:with honors?|cum laude|magna cum laude|summa cum laude|tesda scholar|scholar)\b/i', $value, $matches)) {
            foreach ($matches[0] as $match) {
                $honors[] = $this->formatEducationText($match);
            }
        }

        return [
            'attendance_period' => $attendancePeriod,
            'year_graduated' => $yearGraduated,
            'honors' => $honors ? implode(', ', array_values(array_unique($honors))) : null,
        ];
    }

    private function removeEducationMetaText(string $value): string
    {
        $value = preg_replace('/\b\d{1,2}\/\d{1,2}\/\d{4}\s*(?:-|to)?\s*\d{1,2}\/\d{1,2}\/\d{4}\b/i', ' ', (string) $value);
        $value = preg_replace('/\b(?:19|20)\d{2}\b/', ' ', (string) $value);
        $value = preg_replace('/\b(?:with honors?|cum laude|magna cum laude|summa cum laude|tesda scholar|scholar)\b/i', ' ', (string) $value);
        $value = preg_replace('/\s+/u', ' ', (string) $value);

        return trim((string) $value, " \t\n\r\0\x0B:-|/.,");
    }

    private function educationSummary(array $entry): string
    {
        return implode(' - ', array_filter([
            $entry['level'] ?? null,
            $entry['school'] ?? null,
            $entry['degree'] ?? null,
        ]));
    }

    private function formatSchoolName(string $value): string
    {
        return $this->formatEducationText($value);
    }

    private function formatEducationText(string $value): string
    {
        $value = trim(preg_replace('/\s+/u', ' ', $value));
        if ($value === '') {
            return '';
        }

        if (mb_strtoupper($value) === $value) {
            $value = Str::title(Str::lower($value));
            $value = preg_replace_callback('/\b(?:Of|And|In|For|The|At|On)\b/', fn ($match) => Str::lower($match[0]), $value);
        }

        $value = preg_replace_callback('/\b(?:ncii|nc\s+ii|tesda|pds|cs)\b/i', fn ($match) => mb_strtoupper($match[0]), $value);

        return $value;
    }

    private function section(array $lines, array $startHeaders, array $stopHeaders): array
    {
        $section = [];
        $capturing = false;
        $startPattern = '/\b(?:' . implode('|', array_map(fn ($header) => preg_quote($header, '/'), $startHeaders)) . ')\b/i';
        $stopPattern = $stopHeaders
            ? '/\b(?:' . implode('|', array_map(fn ($header) => preg_quote($header, '/'), $stopHeaders)) . ')\b/i'
            : null;

        foreach ($lines as $line) {
            if (!$capturing && preg_match($startPattern, $line)) {
                if ($this->isFalseSectionStart($line, $startHeaders)) {
                    continue;
                }
                $capturing = true;
                $line = trim((string) preg_replace($startPattern, '', $line, 1));
                if ($line === '') {
                    continue;
                }
            }

            if (!$capturing) {
                continue;
            }

            if ($stopPattern && preg_match($stopPattern, $line)) {
                break;
            }

            $section[] = $line;
        }

        return $section;
    }

    private function isFalseSectionStart(string $line, array $startHeaders): bool
    {
        $lower = Str::lower($line);

        return in_array('work experience', $startHeaders, true)
            && (Str::contains($lower, 'work experience sheet')
                || Str::contains($lower, 'description of duties should be indicated'));
    }

    private function extractRows(array $lines, int $limit): array
    {
        $rows = [];
        $seen = [];
        foreach ($lines as $line) {
            $value = $this->cleanValue($line);
            if ($value === '' || mb_strlen($value) < 4) {
                continue;
            }
            if (preg_match('/^(n\/a|not applicable|none)$/i', $value) || $this->looksLikeLabelOnly($value)) {
                continue;
            }
            $key = Str::lower($value);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $rows[] = Str::limit($value, 240, '');
            if (count($rows) >= $limit) {
                break;
            }
        }

        return $rows;
    }

    private function parseEducationEntry(string $row, ?string $level = null): ?array
    {
        $row = $this->removePdsTableHeaders($this->cleanValue($row));
        if (!$this->isUsefulEducationValue($row) || $this->isPdsTableHeaderRemainder($row)) {
            return null;
        }

        $year = null;
        if (preg_match('/\b((?:19|20)\d{2})\b(?!.*\b(?:19|20)\d{2}\b)/', $row, $match)) {
            $year = $match[1];
            $row = trim((string) preg_replace('/\b' . preg_quote($year, '/') . '\b(?!.*\b(?:19|20)\d{2}\b)/', '', $row, 1));
        }

        $degree = null;
        $degreePattern = '/\b((?:Bachelor|Master|Doctor|Ph\.?D\.?|BS|BA|MA|MS|MBA|B\.S\.|B\.A\.|M\.A\.|M\.S\.)[A-Za-z\s\.]*(?:in|of)?\s*[A-Za-z\s&.-]{0,90})/i';
        if (preg_match($degreePattern, $row, $match, PREG_OFFSET_CAPTURE)) {
            $degree = $this->cleanValue($match[1][0]);
            $row = trim(substr($row, 0, (int) $match[1][1]) . ' ' . substr($row, (int) $match[1][1] + strlen($match[1][0])));
        }

        $school = $this->cleanValue($row);
        $summaryParts = array_filter([
            $level,
            $school,
            $degree,
            $year,
        ]);

        return [
            'level' => $level,
            'school' => $school ?: null,
            'degree' => $degree,
            'year_graduated' => $year,
            'summary' => implode(' - ', $summaryParts),
        ];
    }

    private function parseExperienceEntry(string $row): ?array
    {
        $summary = $this->formatExperienceRow($row);
        if ($summary === '') {
            return null;
        }

        $working = $summary;
        $dateRange = null;
        if (preg_match('/\b((?:\d{1,2}\/\d{1,2}\/\d{2,4}|(?:19|20)\d{2}|present|current)\s*(?:-|to)\s*(?:\d{1,2}\/\d{1,2}\/\d{2,4}|(?:19|20)\d{2}|present|current))\b/i', $working, $match)) {
            $dateRange = $match[1];
            $working = trim((string) str_replace($match[0], '', $working));
        }

        $status = null;
        if (preg_match('/\b(permanent|temporary|contractual|casual|job order|coterminous)\b/i', $working, $match)) {
            $status = Str::title(Str::lower($match[1]));
            $working = trim((string) preg_replace('/\b' . preg_quote($match[1], '/') . '\b/i', '', $working, 1));
        }

        $parts = preg_split('/\s{2,}|\s+\|\s+|\s+-\s+/', $working) ?: [];
        $parts = array_values(array_filter(array_map(fn ($part) => $this->cleanValue((string) $part), $parts)));

        $position = $parts[0] ?? null;
        $agency = count($parts) >= 2 ? implode(' - ', array_slice($parts, 1)) : null;
        if (!$agency && $position) {
            [$position, $agency] = $this->splitPositionAndAgency($position);
        }

        return [
            'inclusive_dates' => $dateRange,
            'position' => $position ?: null,
            'agency' => $agency ?: null,
            'appointment_status' => $status,
            'summary' => $summary,
        ];
    }

    private function splitPositionAndAgency(string $value): array
    {
        $value = $this->cleanValue($value);
        $titleWords = [
            'accountant',
            'administrator',
            'assistant',
            'clerk',
            'coordinator',
            'developer',
            'engineer',
            'instructor',
            'manager',
            'officer',
            'professor',
            'secretary',
            'specialist',
            'staff',
            'supervisor',
            'teacher',
        ];
        $titlePattern = implode('|', array_map(fn ($word) => preg_quote($word, '/'), $titleWords));

        if (preg_match('/^(.+?\b(?:' . $titlePattern . ')\b)\s+(.+)$/i', $value, $match)) {
            return [
                $this->cleanValue($match[1]),
                $this->cleanValue($match[2]),
            ];
        }

        if (preg_match('/^(.+?)\s+((?:[A-Z][A-Za-z.&-]+)(?:\s+[A-Z][A-Za-z.&-]+){1,8})$/', $value, $match)) {
            return [
                $this->cleanValue($match[1]),
                $this->cleanValue($match[2]),
            ];
        }

        return [$value, null];
    }

    private function cleanValue(string $value): string
    {
        $value = preg_replace('/\b(?:n\/a|not applicable)\b/i', '', $value);
        $value = preg_replace('/\b(?:cs\s*form(?:\s+no\.?)?\s*212|revised\s+\d{4}|personal data sheet)\b/i', '', (string) $value);
        $value = $this->removeParentheticalText((string) $value);
        $value = str_replace(['(', ')'], ' ', (string) $value);
        $value = preg_replace('/[_]{2,}/', ' ', (string) $value);
        $value = preg_replace('/\s+(?:please indicate|write|type|print)\b.*$/i', '', (string) $value);
        $value = preg_replace('/\s+/u', ' ', (string) $value);
        $value = trim((string) $value, " \t\n\r\0\x0B:-|");

        return $value;
    }

    private function removeParentheticalText(string $value): string
    {
        for ($i = 0; $i < 3; $i++) {
            $cleaned = preg_replace('/\s*\([^()]*\)\s*/u', ' ', $value);
            if ($cleaned === $value) {
                break;
            }
            $value = (string) $cleaned;
        }

        return $value;
    }

    private function cleanPdsTableLines(array $lines): array
    {
        return array_values(array_filter(array_map(function ($line) {
            $line = $this->removePdsTableHeaders($this->cleanValue((string) $line));
            return $line !== '' ? $line : null;
        }, $lines)));
    }

    private function removePdsTableHeaders(string $value): string
    {
        $headers = [
            'level',
            'name of school',
            'basic education',
            'degree course',
            'period of attendance',
            'highest level',
            'units earned',
            'year graduated',
            'scholarship',
            'academic honors',
            'inclusive dates',
            'title of learning and development',
            'learning and development interventions',
            'type of ld',
            'number of hours',
            'conducted',
            'sponsored by',
            'position title',
            'department agency office company',
            'monthly salary',
            'salary job pay grade',
            'status of appointment',
            'govt service',
        ];

        foreach ($headers as $header) {
            $value = preg_replace('/\b' . preg_quote($header, '/') . '\b\s*:?\s*/i', ' ', (string) $value);
        }

        $value = preg_replace('/\b(?:from|to)\b\s*(?=\b(?:from|to|position|department|monthly|status|govt)\b)/i', ' ', (string) $value);
        $value = preg_replace('/\s+/u', ' ', (string) $value);

        return trim((string) $value, " \t\n\r\0\x0B:-|");
    }

    private function isUsefulEducationValue(string $value): bool
    {
        $value = trim($value);
        if ($value === '' || mb_strlen($value) < 5 || $this->looksLikeLabelOnly($value)) {
            return false;
        }

        return preg_match('/\b(?:school|college|university|elementary|secondary|vocational|graduate|bachelor|master|doctor|degree|course|education|high school|academy|institute|bs|ba|ma|ms|phd|units?|graduated|graduate)\b/i', $value) === 1
            || preg_match('/\b(?:19|20)\d{2}\b/', $value) === 1;
    }

    private function splitExperienceText(string $value): array
    {
        $value = $this->removePdsTableHeaders($value);
        $value = preg_replace('/(?<!^)\b((?:\d{1,2}\/\d{1,2}\/\d{2,4}|(?:19|20)\d{2}|present|current)\s*(?:-|to)\s*(?:\d{1,2}\/\d{1,2}\/\d{2,4}|(?:19|20)\d{2}|present|current))/i', "\n$1", (string) $value);
        $parts = preg_split("/\n+|;\s*/", (string) $value) ?: [];

        return array_values(array_filter(array_map(fn ($part) => $this->cleanValue((string) $part), $parts)));
    }

    private function formatExperienceRow(string $row): string
    {
        $row = $this->removePdsTableHeaders($this->cleanValue($row));
        if ($row === '' || mb_strlen($row) < 5 || $this->looksLikeLabelOnly($row)) {
            return '';
        }
        if ($this->isPdsTableHeaderRemainder($row)) {
            return '';
        }
        if (preg_match('/^(?:from|to|from to|date|signature|status of|status of appointment|continue on separate sheet if necessary|[a-z]+ \d{1,2}, \d{4})$/i', $row)) {
            return '';
        }
        if (preg_match('/\b(?:email|telephone|mobile|address|zip code|barangay|province|municipality|citizenship|civil status|date of birth|work experience sheet|special skills|number of hours|conducted|sponsored by)\b/i', $row)) {
            return '';
        }
        if (preg_match('/^\d{1,2}\/\d{1,2}\/\d{4}\s*\d{1,2}\/\d{1,2}\/\d{4}\s+\d+\s+[a-z ]+$/i', $row)) {
            return '';
        }

        $row = preg_replace('/\s+(Y|N|YES|NO)\s*$/i', '', (string) $row);
        $row = preg_replace('/\s+\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s+(?:permanent|temporary|contractual|casual|job order)\b/i', ' ', (string) $row);
        $row = preg_replace('/\s+/u', ' ', (string) $row);

        return trim((string) Str::limit($row, 220, ''));
    }

    private function isPdsTableHeaderRemainder(string $value): bool
    {
        $normalized = Str::lower(trim($value));
        if ($normalized === '') {
            return true;
        }

        return preg_match('/^(?:\/?\s*)?(?:degree|course|agency|office|company|department|position|salary|appointment|service|earned|graduated|attendance|school|honors?)(?:\s*\/\s*(?:degree|course|agency|office|company|department|position|salary|appointment|service|earned|graduated|attendance|school|honors?))*$/i', $normalized) === 1
            || preg_match('/\b(?:basic education|degree\/course|department\/agency|office\/company|monthly salary|status of appointment|govt service|inclusive dates)\b/i', $normalized) === 1;
    }

    private function uniqueRows(array $rows): array
    {
        $seen = [];
        $result = [];
        foreach ($rows as $row) {
            $row = $this->cleanValue((string) $row);
            if ($row === '') {
                continue;
            }
            $key = Str::lower($row);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $result[] = $row;
        }

        return $result;
    }

    private function uniqueEntries(array $entries, string $key): array
    {
        $seen = [];
        $result = [];
        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $value = Str::lower(trim((string) ($entry[$key] ?? '')));
            if ($value === '' || isset($seen[$value])) {
                continue;
            }
            $seen[$value] = true;
            $result[] = $entry;
        }

        return $result;
    }

    private function uniqueEducationEntries(array $entries): array
    {
        $seen = [];
        $result = [];

        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $levelKey = $this->educationLevelKey($entry['level'] ?? null);
            $summary = trim((string) ($entry['summary'] ?? ''));
            $key = $levelKey !== null ? 'level:' . $levelKey : 'summary:' . Str::lower($summary);
            if ($summary === '' || isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $result[] = $entry;
        }

        return $result;
    }

    private function trimAtNextLabel(string $value): string
    {
        $stopPattern = implode('|', array_map(fn ($item) => preg_quote($item, '/'), $this->stopLabels()));
        $value = preg_replace('/\s+\b(?:' . $stopPattern . ')\b\s*(?::|-|\.|\))?.*$/iu', '', $value);

        return $this->cleanValue((string) $value);
    }

    private function stopLabels(): array
    {
        return [
            'surname',
            'first name',
            'middle name',
            'name extension',
            'date of birth',
            'place of birth',
            'sex',
            'civil status',
            'height',
            'weight',
            'blood type',
            'gsis id',
            'pag-ibig id',
            'philhealth',
            'sss',
            'tin',
            'agency employee',
            'citizenship',
            'residential address',
            'permanent address',
            'telephone',
            'mobile',
            'email',
            'spouse',
            'father',
            'mother',
            'educational background',
            'civil service eligibility',
            'work experience',
            'special skills',
            'skills',
            'other information',
        ];
    }

    private function isLikelyFieldValue(?string $value): bool
    {
        $value = trim((string) $value);
        if ($value === '' || mb_strlen($value) > 180) {
            return false;
        }

        return !preg_match('/^(?:yes|no)?\s*$/i', $value);
    }

    private function isRejectedNameValue(string $value): bool
    {
        return preg_match('/\b(?:occupation|employer|business|address|telephone|mobile|email|date|birth|civil status|citizenship|height|weight|blood type|school|college|position|department|salary|appointment)\b/i', $value) === 1;
    }

    private function looksLikeLabelOnly(string $value): bool
    {
        $normalized = Str::lower(trim($value));
        if ($normalized === '') {
            return true;
        }

        return preg_match('/^(?:\d+\s*[\.\)]\s*)?(?:surname|first name|middle name|name extension|date of birth|place of birth|sex|civil status|height|weight|blood type|citizenship|residential address|permanent address|telephone no|mobile no|email address|educational background|civil service eligibility|work experience|voluntary work|learning and development|other information)\s*:?\s*$/i', $normalized) === 1
            || preg_match_all('/\b(?:surname|first name|middle name|date of birth|place of birth|civil status|educational background|work experience)\b/i', $normalized) >= 2;
    }
}
