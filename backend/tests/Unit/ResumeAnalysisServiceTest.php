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

    public function test_training_hours_are_scored_against_required_hours(): void
    {
        $text = 'Training: Records Management Seminar. Number of Hours Credit: 4. Leadership Workshop 4 hours.';

        $this->assertSame(100.0, $this->callPrivate('calculateTrainingScore', $text, '4 hours relevant training'));
        $this->assertSame(50.0, $this->callPrivate('calculateTrainingScore', $text, '16 hours relevant training'));
    }

    public function test_non_training_skill_requirements_do_not_count_as_missing_training(): void
    {
        $requirement = 'Teaching, Lesson Planning, Classroom Management';

        $this->assertSame(100.0, $this->callPrivate('calculateTrainingScore', '', $requirement));
        $this->assertSame([], $this->callPrivate('missingTrainingRequirements', '', $requirement));
        $this->assertSame(['Teaching', 'Lesson Planning', 'Classroom Management'], $this->callPrivate('skillRequirementsFromRequirement', $requirement));
        $this->assertSame([], $this->callPrivate('skillRequirementsFromRequirement', '4 hours relevant training'));
    }

    public function test_eligibility_requirement_matches_common_civil_service_wording(): void
    {
        $text = 'Eligibility certificate: Career Service Professional Second Level Eligibility.';

        $this->assertSame(100.0, $this->callPrivate('calculateEligibilityScore', $text, 'Career Service Professional/Second Level Eligibility'));
        $this->assertSame(0.0, $this->callPrivate('calculateEligibilityScore', $text, 'Career Service (Sub Professional)/First Level Eligibility'));
    }

    public function test_qualification_standards_score_uses_equal_category_weights(): void
    {
        $this->assertSame(70.0, $this->callPrivate('calculateQualificationStandardsScore', 100.0, 50.0, 100.0, 50.0, 50.0));
    }

    private function callPrivate(string $method, mixed ...$arguments): mixed
    {
        $reflection = new ReflectionMethod($this->service, $method);
        $reflection->setAccessible(true);

        return $reflection->invoke($this->service, ...$arguments);
    }
}
