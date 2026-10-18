<?php

namespace Tests\Feature;

use App\Models\Experience;
use App\Models\Job;
use App\Models\JobSeeker;
use App\Models\Upload;
use App\Services\ResumeAnalysisService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ExperienceRequirementTest extends TestCase
{
    use DatabaseTransactions;

    private JobSeeker $jobSeeker;
    private Job $job;
    private string $resumeText = "Professional Summary\nApplicant with strong administrative and records management skills.\nSkills\nRecords Management, Microsoft Excel";

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        Storage::fake('local');
        $this->jobSeeker = JobSeeker::create([
            'full_name' => 'Experience Requirement Applicant',
            'email' => 'experience-requirement-'.Str::uuid().'@example.com',
            'password' => 'test-password',
        ]);
        $this->job = Job::create([
            'title' => 'Experience Requirement Job '.Str::uuid(),
            'description' => 'Administrative position requiring two years of employment experience.',
            'status' => 'active',
            'minimum_experience_years' => 2,
            'minimum_education' => 'None required',
            'eligibility' => 'None required',
            'required_skills' => 'None required',
        ]);
        Storage::disk('local')->put('experience-requirement/pds.txt', $this->resumeText);
        Upload::create([
            'job_seeker_id' => $this->jobSeeker->id,
            'name' => $this->jobSeeker->full_name,
            'email' => $this->jobSeeker->email,
            'file_path' => 'experience-requirement/pds.txt',
            'original_name' => 'pds.txt',
            'mime_type' => 'text/plain',
            'uploaded_at' => now(),
        ]);
    }

    public function test_high_overall_score_cannot_compensate_for_missing_experience(): void
    {
        $response = $this->preview()->assertOk()->assertJson([
            'allowApplication' => false,
            'experienceRequirementMet' => false,
            'analysis' => ['classification' => 'Not Qualified', 'experience_match_score' => 0],
        ]);
        $this->assertGreaterThanOrEqual(50, $response->json('matchScore'));
        $this->assertStringContainsString('minimum experience', $response->json('applicationBlockReason'));
    }

    public function test_batch_marks_insufficient_experience_as_not_match(): void
    {
        $response = $this->postJson('/api/job-seekers/'.$this->jobSeeker->id.'/resume/match/batch', [
            'jobTitles' => [$this->job->title], 'jobIds' => [$this->job->id],
        ])->assertOk()->assertJsonPath('matches.0.qualifies', false)
            ->assertJsonPath('matches.0.allowApplication', false)
            ->assertJsonPath('matches.0.experienceRequirementMet', false);

        $this->assertGreaterThanOrEqual(50, $response->json('matches.0.score'));
    }

    public function test_application_is_rejected_even_if_client_provides_a_perfect_score(): void
    {
        $this->submit()->assertUnprocessable()->assertJson([
            'message' => 'You do not meet the minimum experience required for this job.',
        ]);
        $this->assertSame(0, Upload::query()->applications()->where('job_seeker_id', $this->jobSeeker->id)->count());
        $this->assertSame([], Storage::disk('local')->files('uploads/resumes'));
    }

    public function test_partial_experience_is_not_enough(): void
    {
        $this->addExperience('2020-01-01', '2020-12-31');

        $this->preview()->assertOk()->assertJsonPath('analysis.experience_match_score', 50)
            ->assertJsonPath('allowApplication', false)
            ->assertJsonPath('experienceRequirementMet', false);
    }

    public function test_meeting_minimum_experience_allows_matching_and_applying(): void
    {
        $this->addExperience('2020-01-01', '2021-12-31');

        $this->preview()->assertOk()->assertJsonPath('allowApplication', true)
            ->assertJsonPath('experienceRequirementMet', true);
        $this->postJson('/api/job-seekers/'.$this->jobSeeker->id.'/resume/match/batch', [
            'jobTitles' => [$this->job->title], 'jobIds' => [$this->job->id],
        ])->assertOk()->assertJsonPath('matches.0.qualifies', true);
        $this->submit()->assertCreated();
    }

    public function test_jobs_with_no_experience_minimum_remain_available(): void
    {
        $this->job->update(['minimum_experience_years' => 0]);

        $this->preview()->assertOk()->assertJsonPath('allowApplication', true)
            ->assertJsonPath('experienceRequirementMet', true);
        $this->submit()->assertCreated();
    }

    public function test_standalone_matching_also_requires_minimum_experience(): void
    {
        $matches = $this->app->make(ResumeAnalysisService::class)->matchJobs($this->resumeText, [$this->job]);

        $this->assertGreaterThanOrEqual(50, $matches[0]['overallScore']);
        $this->assertFalse($matches[0]['allowApplication']);
        $this->assertFalse($matches[0]['experienceRequirementMet']);
        $this->assertSame('Not Qualified', $matches[0]['classification']);
    }

    public function test_zero_experience_weight_does_not_remove_the_minimum_requirement(): void
    {
        $this->job->update([
            'experience_weight' => 0, 'education_weight' => 25, 'training_weight' => 25,
            'skills_weight' => 25, 'eligibility_weight' => 25,
        ]);

        $this->preview()->assertOk()->assertJsonPath('matchScore', 100)
            ->assertJsonPath('allowApplication', false)
            ->assertJsonPath('experienceRequirementMet', false);
    }

    public function test_preset_jobs_cannot_bypass_minimum_experience(): void
    {
        foreach (['Universal Applicant Match', 'Universal Moderate Match', 'Universal Not Qualified Match', 'Universal 55 Percent Match'] as $title) {
            $this->job->update(['title' => $title]);
            $this->preview()->assertOk()->assertJsonPath('allowApplication', false)
                ->assertJsonPath('experienceRequirementMet', false);
            $matches = $this->app->make(ResumeAnalysisService::class)->matchJobs($this->resumeText, [$this->job]);
            $this->assertFalse($matches[0]['allowApplication']);
        }
    }

    private function addExperience(string $start, string $end): void
    {
        Experience::create([
            'job_seeker_id' => $this->jobSeeker->id,
            'position' => 'Administrative Officer',
            'company_name' => 'Company',
            'start_date' => $start,
            'end_date' => $end,
        ]);
    }

    private function preview(): \Illuminate\Testing\TestResponse
    {
        return $this->getJson('/api/job-seekers/'.$this->jobSeeker->id.'/resume/match?'.http_build_query([
            'jobId' => $this->job->id, 'jobTitle' => $this->job->title,
        ]));
    }

    private function submit(): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/upload', [
            'file' => UploadedFile::fake()->createWithContent('pds.txt', $this->resumeText),
            'name' => $this->jobSeeker->full_name,
            'email' => $this->jobSeeker->email,
            'jobSeekerId' => $this->jobSeeker->id,
            'jobId' => $this->job->id,
            'appliedJobTitle' => $this->job->title,
            'totalMatchScore' => 100,
        ]);
    }
}
