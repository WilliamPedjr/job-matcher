<?php

namespace Tests\Unit;

use App\Services\PdsExtractionService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class PdsExtractionServiceTest extends TestCase
{
    private PdsExtractionService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new PdsExtractionService();
    }

    public function test_format_extracts_core_pds_sections_and_filters_hobbies_from_skills(): void
    {
        $pdsText = implode("\n", [
            'PERSONAL DATA SHEET',
            'CS Form No. 212',
            'PERSONAL INFORMATION',
            'SURNAME FIRST NAME MIDDLE NAME',
            'DE LA CRUZ JUAN SANTOS',
            'EDUCATIONAL BACKGROUND',
            'COLLEGE Leyte Normal University Bachelor of Science in Information Technology 2024',
            'CIVIL SERVICE ELIGIBILITY',
            'Career Service Professional Second Level Eligibility 2024 Tacloban City',
            'WORK EXPERIENCE',
            '01/01/2022 - 12/31/2024 Administrative Officer Leyte Normal University Permanent',
            'SPECIAL SKILLS AND HOBBIES',
            'Microsoft Excel; Records Management; Reading books',
        ]);

        $result = $this->service->format($pdsText);

        $this->assertTrue($result['detected']);
        $this->assertSame('high', $result['confidence']);
        $this->assertSame('JUAN SANTOS DE LA CRUZ', $result['name']);
        $this->assertContains('Microsoft Excel', $result['skills']);
        $this->assertContains('Records Management', $result['skills']);
        $this->assertNotContains('Reading Books', $result['skills']);
        $this->assertStringContainsString('Leyte Normal University', implode(' ', $result['education']));
        $this->assertStringContainsString('Career Service Professional', implode(' ', $result['eligibility']));
        $this->assertStringContainsString('Administrative Officer', implode(' ', $result['experience']));
        $this->assertStringContainsString('Skills:', $result['matching_text']);
        $this->assertStringContainsString('Education:', $result['matching_text']);
        $this->assertStringContainsString('Experience:', $result['matching_text']);
    }

    public function test_skill_normalization_deduplicates_generic_management_and_rejects_table_noise(): void
    {
        $this->assertSame([
            'Office Management',
            'MS Excel',
        ], $this->callPrivate('uniqueSkills', [
            'Management',
            'Office Management',
            'MANAGEMENT',
            'ms excel',
            'Reading books',
            'Page 1 of 4',
            'Number of Hours',
        ]));
    }

    public function test_education_level_inference_and_school_continuation_cover_positive_and_negative_paths(): void
    {
        $this->assertSame('college', $this->callPrivate('inferEducationLevelFromSchool', 'Leyte Normal University'));
        $this->assertSame('secondary', $this->callPrivate('inferEducationLevelFromSchool', 'Leyte National High School'));
        $this->assertNull($this->callPrivate('inferEducationLevelFromSchool', 'Barangay Hall'));

        $this->assertTrue($this->callPrivate('isSchoolContinuation', 'Leyte Normal University -', 'Main Campus'));
        $this->assertFalse($this->callPrivate('isSchoolContinuation', 'Leyte Normal University', 'Mobile Number'));
    }

    private function callPrivate(string $method, mixed ...$arguments): mixed
    {
        $reflection = new ReflectionMethod($this->service, $method);
        $reflection->setAccessible(true);

        return $reflection->invoke($this->service, ...$arguments);
    }
}
