<?php

namespace Tests\Unit;

use App\Services\PdsExtractionService;
use App\Services\ResumeAnalysisService;
use App\Services\TextExtractionService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class ResumeAnalysisServiceTest extends TestCase
{
    private ResumeAnalysisService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new ResumeAnalysisService(
            new TextExtractionService(),
            new PdsExtractionService()
        );
    }

    public function test_none_required_skills_are_treated_as_no_required_skills(): void
    {
        $this->assertSame([], $this->callPrivate('splitSkills', 'None required'));
        $this->assertSame(100.0, $this->callPrivate('calculateSkillsScore', [], []));
    }

    public function test_zero_minimum_experience_receives_full_credit(): void
    {
        $this->assertSame(100.0, $this->callPrivate('calculateExperienceScore', [], 0));
    }

    public function test_administrative_skill_matches_common_administration_wording(): void
    {
        $matches = $this->callPrivate(
            'findMatchedSkills',
            'Experienced in administration, office operations, and records management.',
            ['Administrative']
        );

        $this->assertSame(['Administrative'], $matches);
    }

    public function test_open_or_basic_education_requirement_receives_full_credit(): void
    {
        $this->assertSame(100.0, $this->callPrivate('calculateEducationScore', [], ''));
        $this->assertSame(100.0, $this->callPrivate('calculateEducationScore', [], 'Must be able to read and write'));
    }

    private function callPrivate(string $method, mixed ...$arguments): mixed
    {
        $reflection = new ReflectionMethod($this->service, $method);
        $reflection->setAccessible(true);

        return $reflection->invoke($this->service, ...$arguments);
    }
}
