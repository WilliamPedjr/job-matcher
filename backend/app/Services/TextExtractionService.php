<?php

namespace App\Services;

use Smalot\PdfParser\Parser;
use ZipArchive;

class TextExtractionService
{
    public function extract(string $path, ?string $mimeType = null): string
    {
        $mimeType = $mimeType ?: @mime_content_type($path) ?: '';
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        if ($mimeType === 'application/pdf' || $extension === 'pdf') {
            try {
                $parser = new Parser();
                $pdf = $parser->parseFile($path);
                $text = $this->normalizeKeepLines($pdf->getText());
                if ($text !== '') {
                    return $this->cleanupExtractedText($text);
                }

                return $this->extractWithOcr($path);
            } catch (\Throwable $e) {
                return $this->extractWithOcr($path);
            }
        }

        if ($mimeType === 'text/plain' || $extension === 'txt') {
            $text = @file_get_contents($path);
            return $this->cleanupExtractedText($text ?: '');
        }

        if ($extension === 'docx') {
            return $this->extractDocx($path);
        }

        if ($this->isImageFile($extension, $mimeType)) {
            return $this->extractWithOcr($path);
        }

        return '';
    }

    private function extractDocx(string $path): string
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            return '';
        }

        $xml = $zip->getFromName('word/document.xml') ?: '';
        $zip->close();

        if ($xml === '') {
            return '';
        }

        $xml = preg_replace('/<\/w:p>/i', "\n", $xml) ?: $xml;
        $xml = preg_replace('/<w:(?:br|tab)[^>]*\/>/i', ' ', $xml) ?: $xml;
        $xml = preg_replace('/<\/w:tr>/i', "\n", $xml) ?: $xml;
        $text = strip_tags($xml);
        return $this->cleanupExtractedText(html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8'));
    }

    private function extractWithOcr(string $path): string
    {
        $binary = $this->resolveTesseractBinary();
        if ($binary === null) {
            return '';
        }

        $cmd = escapeshellarg($binary) . ' ' . escapeshellarg($path) . ' stdout --psm 6 2>NUL';
        $output = @shell_exec($cmd);

        return $this->cleanupExtractedText($output ?: '');
    }

    private function resolveTesseractBinary(): ?string
    {
        if (PHP_OS_FAMILY === 'Windows') {
            $output = @shell_exec('where tesseract 2>NUL');
            $paths = array_values(array_filter(array_map('trim', preg_split('/\r?\n/', (string) $output))));
            if (!empty($paths[0])) {
                return $paths[0];
            }

            $commonPaths = [
                'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
                'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
            ];

            foreach ($commonPaths as $candidate) {
                if (is_file($candidate)) {
                    return $candidate;
                }
            }

            return null;
        }

        $output = @shell_exec('command -v tesseract 2>/dev/null');
        $path = trim((string) $output);
        return $path !== '' ? $path : null;
    }

    private function isImageFile(string $extension, string $mimeType): bool
    {
        return in_array($extension, ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'webp'], true)
            || str_starts_with($mimeType, 'image/');
    }

    private function normalize(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', (string) $text));
    }

    private function normalizeKeepLines(string $text): string
    {
        $text = str_replace("\r", "\n", (string) $text);
        $text = preg_replace("/[ \t]+/u", ' ', $text);
        $text = preg_replace("/\n{3,}/u", "\n\n", $text);

        return trim((string) $text);
    }

    private function normalizeOcrText(string $text): string
    {
        return str_replace(
            ["\u{2013}", "\u{2014}", "“", "”", "‘", "’"],
            ["-", "-", '"', '"', "'", "'"],
            (string) $text
        );
    }

    private function isHeaderLine(string $line): bool
    {
        $normalized = trim(strtolower(preg_replace('/[:\-]+$/', '', $line)));
        if ($normalized === '') {
            return false;
        }

        $aliases = [
            'contact' => true,
            'profile' => true,
            'summary' => true,
            'objective' => true,
            'skills' => true,
            'skill' => true,
            'work experience' => true,
            'experience' => true,
            'employment history' => true,
            'education' => true,
            'certifications' => true,
            'certification' => true,
            'references' => true,
            'reference' => true,
        ];

        return isset($aliases[$normalized]);
    }

    private function normalizeHeader(string $line): string
    {
        $normalized = trim(strtolower(preg_replace('/[:\-]+$/', '', $line)));
        $headers = [
            'contact' => 'CONTACT',
            'profile' => 'PROFILE',
            'summary' => 'SUMMARY',
            'objective' => 'SUMMARY',
            'skills' => 'SKILLS',
            'skill' => 'SKILLS',
            'work experience' => 'WORK EXPERIENCE',
            'experience' => 'WORK EXPERIENCE',
            'employment history' => 'WORK EXPERIENCE',
            'education' => 'EDUCATION',
            'certifications' => 'CERTIFICATIONS',
            'certification' => 'CERTIFICATIONS',
            'references' => 'REFERENCE',
            'reference' => 'REFERENCE',
        ];

        return $headers[$normalized] ?? $line;
    }

    private function isBulletLine(string $line): bool
    {
        return preg_match('/^[\-\x{2022}*]\s+/u', $line) === 1;
    }

    private function endsWithSentence(string $line): bool
    {
        return preg_match('/[.!?:;)]$/', $line) === 1;
    }

    private function startsLowercase(string $line): bool
    {
        return preg_match('/^[a-z]/', $line) === 1;
    }

    private function normalizeLines(array $lines): array
    {
        return array_values(array_filter(array_map(
            fn ($line) => trim(preg_replace('/\s+/u', ' ', (string) $line)),
            $lines
        )));
    }

    private function detectMultiColumnLines(array $lines): bool
    {
        if (!$lines) {
            return false;
        }

        $multiLines = array_filter($lines, function ($line) {
            $parts = array_values(array_filter(array_map('trim', preg_split('/\s{2,}/', (string) $line) ?: [])));
            return count($parts) >= 2;
        });

        return count($multiLines) >= 5 && (count($multiLines) / max(count($lines), 1)) >= 0.2;
    }

    private function separateColumns(array $lines): array
    {
        $left = [];
        $right = [];
        $sawRight = false;

        foreach ($lines as $rawLine) {
            $parts = preg_split('/\s{2,}/', (string) $rawLine) ?: [];
            $trimmedParts = array_values(array_filter(array_map('trim', $parts)));

            if (count($trimmedParts) >= 2) {
                $left[] = $trimmedParts[0];
                $right[] = implode(' ', array_slice($trimmedParts, 1));
                $sawRight = true;
                continue;
            }

            if (count($trimmedParts) === 1) {
                $line = $trimmedParts[0];
                $isIndented = preg_match('/^\s{4,}/', (string) $rawLine) === 1;
                if ($sawRight && $isIndented) {
                    $right[] = $line;
                } else {
                    $left[] = $line;
                }
            }
        }

        if (!$right) {
            return $left;
        }

        return array_merge($left, [''], $right);
    }

    private function cleanupLines(array $rawLines): array
    {
        $cleaned = [];

        for ($i = 0; $i < count($rawLines); $i++) {
            $line = $rawLines[$i];
            if ($line === '') {
                continue;
            }

            if ($this->isHeaderLine($line)) {
                $header = $this->normalizeHeader($line);
                if ($cleaned && end($cleaned) !== '') {
                    $cleaned[] = '';
                }
                $cleaned[] = $header;
                $cleaned[] = '';
                continue;
            }

            if (preg_match('/^[\x{2022}*]/u', $line) === 1) {
                $line = '- ' . preg_replace('/^[\x{2022}*]\s*/u', '', $line);
            }

            if (str_ends_with($line, '-') && isset($rawLines[$i + 1])) {
                $next = $rawLines[$i + 1];
                if ($next !== '' && $this->startsLowercase($next)) {
                    $line = substr($line, 0, -1) . $next;
                    $i++;
                }
            }

            $next = $rawLines[$i + 1] ?? null;
            if (
                $next !== null &&
                !$this->isHeaderLine($next) &&
                !$this->isBulletLine($line) &&
                !$this->isBulletLine($next) &&
                !$this->endsWithSentence($line) &&
                $this->startsLowercase($next)
            ) {
                $line .= ' ' . $next;
                $i++;
            }

            $cleaned[] = $line;
        }

        return $cleaned;
    }

    private function reorderSections(array $lines): array
    {
        $sections = [];
        $other = [];
        $currentHeader = null;

        foreach ($lines as $line) {
            if ($line === '') {
                continue;
            }

            if ($this->isHeaderLine($line)) {
                $currentHeader = $this->normalizeHeader($line);
                $sections[$currentHeader] = $sections[$currentHeader] ?? [];
                continue;
            }

            if ($currentHeader === null) {
                $other[] = $line;
                continue;
            }

            $sections[$currentHeader][] = $line;
        }

        $result = [];
        if ($other) {
            $result = array_merge($result, $other, ['']);
        }

        $order = [
            'CONTACT',
            'PROFILE',
            'SUMMARY',
            'SKILLS',
            'WORK EXPERIENCE',
            'EDUCATION',
            'CERTIFICATIONS',
            'REFERENCE',
        ];

        foreach ($order as $header) {
            $entries = $sections[$header] ?? [];
            if (!$entries) {
                continue;
            }
            $result = array_merge($result, [$header, ''], $entries, ['']);
        }

        foreach ($sections as $header => $entries) {
            if (in_array($header, $order, true) || !$entries) {
                continue;
            }
            $result = array_merge($result, [$header, ''], $entries, ['']);
        }

        return $result;
    }

    private function cleanupExtractedText(string $input): string
    {
        $source = $this->normalizeOcrText($input);
        $source = str_replace("\r", "\n", $source);
        $source = preg_replace("/\t/u", ' ', $source);
        if ($this->looksLikePdsText((string) $source)) {
            return $this->cleanupPdsText((string) $source);
        }

        $source = $this->insertSectionBreaks((string) $source);

        $originalLines = array_values(array_filter(array_map('trim', preg_split("/\n+/", (string) $source) ?: [])));
        $useColumnSeparation = $this->detectMultiColumnLines($originalLines);
        $columnAdjusted = $useColumnSeparation
            ? $this->separateColumns($originalLines)
            : array_map(fn ($line) => preg_replace('/\s+/u', ' ', trim((string) $line)), $originalLines);

        $normalized = $this->normalizeLines($columnAdjusted);
        $cleaned = $this->cleanupLines($normalized);
        $reordered = $this->reorderSections($cleaned);

        return trim(preg_replace("/\n{3,}/u", "\n\n", implode("\n", $reordered)));
    }

    private function looksLikePdsText(string $text): bool
    {
        $lower = strtolower($text);

        return str_contains($lower, 'personal data sheet')
            || str_contains($lower, 'cs form no. 212')
            || (str_contains($lower, 'civil service commission') && str_contains($lower, 'personal information'));
    }

    private function cleanupPdsText(string $input): string
    {
        $text = preg_replace("/[ \t]+/u", ' ', $input);
        $labels = [
            'PERSONAL INFORMATION',
            'FAMILY BACKGROUND',
            'EDUCATIONAL BACKGROUND',
            'CIVIL SERVICE ELIGIBILITY',
            'WORK EXPERIENCE',
            'VOLUNTARY WORK',
            'LEARNING AND DEVELOPMENT',
            'OTHER INFORMATION',
            'SURNAME',
            'FIRST NAME',
            'MIDDLE NAME',
            'NAME EXTENSION',
            'DATE OF BIRTH',
            'PLACE OF BIRTH',
            'SEX',
            'CIVIL STATUS',
            'HEIGHT',
            'WEIGHT',
            'BLOOD TYPE',
            'GSIS ID NO',
            'PAG-IBIG ID NO',
            'PHILHEALTH NO',
            'SSS NO',
            'TIN NO',
            'AGENCY EMPLOYEE NO',
            'CITIZENSHIP',
            'RESIDENTIAL ADDRESS',
            'PERMANENT ADDRESS',
            'TELEPHONE NO',
            'MOBILE NO',
            'EMAIL ADDRESS',
        ];

        foreach ($labels as $label) {
            $pattern = '/(?<!^)(?<!\n)\b' . preg_quote($label, '/') . '\b\s*(?=:|-|\s)/i';
            $text = preg_replace($pattern, "\n$label", (string) $text);
        }

        $lines = array_values(array_filter(array_map(
            fn ($line) => trim(preg_replace('/\s+/u', ' ', (string) $line)),
            preg_split("/\n+/", (string) $text) ?: []
        )));

        return trim(preg_replace("/\n{3,}/u", "\n\n", implode("\n", $lines)));
    }

    private function insertSectionBreaks(string $text): string
    {
        $headers = [
            'work experience',
            'employment history',
            'education',
            'certifications',
            'certification',
            'skills',
            'skill',
            'summary',
            'objective',
            'profile',
            'contact',
            'references',
            'reference',
        ];

        $pattern = '/\b(' . implode('|', array_map('preg_quote', $headers)) . ')\b/i';
        $text = preg_replace($pattern, "\n$1\n", $text);

        return trim((string) $text);
    }
}
