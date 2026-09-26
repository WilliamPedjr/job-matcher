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

    public function test_qualification_standards_score_uses_custom_weights_and_fallback_weights(): void
    {
        $weightedScore = $this->callPrivate('calculateQualificationStandardsScore', 100.0, 50.0, 0.0, 25.0, 100.0, [
            'education' => 20,
            'training' => 10,
            'experience' => 20,
            'eligibility' => 10,
            'skills' => 40,
        ]);

        $fallbackScore = $this->callPrivate('calculateQualificationStandardsScore', 100.0, 50.0, 100.0, 50.0, 0.0, [
            'education' => 0,
            'training' => 0,
            'experience' => 0,
            'eligibility' => 0,
            'skills' => 0,
        ]);

        $this->assertSame(67.5, $weightedScore);
        $this->assertSame(60.0, $fallbackScore);
    }

    public function test_universal_job_detection_accepts_title_skill_and_item_number_sentinels(): void
    {
        $this->assertFalse($this->callPrivate('isUniversalMatchJob', null));
        $this->assertTrue($this->callPrivate('isUniversalMatchJob', ['title' => 'Universal Applicant Match']));
        $this->assertTrue($this->callPrivate('isUniversalMatchJob', ['required_skills' => '__MATCH_ALL__']));
        $this->assertTrue($this->callPrivate('isUniversalModerateJob', ['requiredSkills' => '__MATCH_MODERATE__']));
        $this->assertTrue($this->callPrivate('isUniversalNotQualifiedJob', ['title' => 'Universal Not Qualified Match']));
        $this->assertTrue($this->callPrivate('isUniversal55PercentJob', ['item_no' => 'LNU-MATCH-004']));
    }

    public function test_training_matching_covers_hour_based_and_topic_based_requirements(): void
    {
        $text = "Training\nRecords Management Seminar\nNumber of Hours Credit: 8\nLeadership Workshop 4 hrs.";

        $this->assertSame(75.0, $this->callPrivate('calculateTrainingScore', $text, '16 hours relevant training'));
        $this->assertSame(['12 training hours found'], $this->callPrivate('matchedTrainingEvidence', $text, '16 hours relevant training', []));
        $this->assertSame(['16 required training hours'], $this->callPrivate('missingTrainingRequirements', $text, '16 hours relevant training'));

        $topicRequirement = 'Records Management seminar, Data Privacy workshop';

        $this->assertSame(50.0, $this->callPrivate('calculateTrainingScore', $text, $topicRequirement));
        $this->assertSame(['Records Management seminar'], $this->callPrivate('matchedTrainingEvidence', $text, $topicRequirement, []));
        $this->assertSame(['Data Privacy workshop'], $this->callPrivate('missingTrainingRequirements', $text, $topicRequirement));
    }

    public function test_resume_section_extractors_stop_at_next_header_and_filter_noise(): void
    {
        $resume = implode("\n", [
            'Professional Summary',
            'Experienced administrative officer with records management and reporting responsibilities.',
            'Skills',
            'Records Management, Microsoft Excel',
            'Education',
            'Leyte Normal University',
            'Bachelor of Science in Information Technology',
            '2024',
            'Work Experience',
            'Administrative Officer - Leyte Normal University - 3 years experience',
            'Email: hidden@example.com',
            'Projects',
            'Implemented a records tracking project for faster office reporting.',
            'References',
            'Available upon request',
        ]);

        $this->assertSame([
            'Experienced administrative officer with records management and reporting responsibilities.',
        ], $this->callPrivate('extractProfileLines', $resume));

        $this->assertSame([
            'Leyte Normal University Bachelor of Science in Information Technology 2024',
        ], $this->callPrivate('extractEducationLines', $resume));

        $this->assertSame([
            'Administrative Officer',
            '3 years experience',
        ], $this->callPrivate('extractExperienceLines', $resume));

        $this->assertSame([
            'Implemented a records tracking project for faster office reporting.',
        ], $this->callPrivate('extractProjectLines', $resume));
    }

    public function test_education_and_experience_scores_cover_degree_and_partial_year_branches(): void
    {
        $educationLines = ['Leyte Normal University - Bachelor of Science in Information Technology'];
        $experienceLines = ['Administrative Officer - Leyte Normal University - 2 years experience'];

        $this->assertSame(50.0, $this->callPrivate('calculateEducationScore', $educationLines, 'Master degree'));
        $this->assertSame(0.0, $this->callPrivate('calculateEducationScore', $educationLines, 'Doctorate degree'));
        $this->assertSame(100.0, $this->callPrivate('calculateEducationScore', ['Secondary - Leyte National High School'], 'High School graduate'));
        $this->assertSame(50.0, $this->callPrivate('calculateExperienceScore', $experienceLines, 4));
    }

    private function callPrivate(string $method, mixed ...$arguments): mixed
    {
        $reflection = new ReflectionMethod($this->service, $method);
        $reflection->setAccessible(true);

        return $reflection->invoke($this->service, ...$arguments);
    }
}
