<?php

namespace Tests\Feature;

use App\Models\JobSeeker;
use App\Models\Upload;
use App\Services\ResumeAnalysisService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApplicationLimitTest extends TestCase
{
    use DatabaseTransactions;

    private JobSeeker $jobSeeker;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        Storage::fake('local');
        $this->jobSeeker = JobSeeker::create([
            'full_name' => 'Application Limit Applicant',
            'email' => 'application-limit-'.Str::uuid().'@example.com',
            'password' => 'test-password',
        ]);
        $this->mock(ResumeAnalysisService::class)->shouldReceive('analyzeFile')->andReturn([
            'overall_score' => 100,
            'skills_match_score' => 100,
            'education_match_score' => 100,
            'experience_match_score' => 100,
            'matched_job_title' => 'Application Limit Test Job',
            'matched_skills' => [],
            'missing_skills' => [],
            'education_text' => '',
            'experience_text' => '',
            'resume_text' => 'Test applicant qualifications.',
            'application_minimum_score' => 50,
        ]);
    }

    public function test_deleting_applications_frees_slots_for_another_application(): void
    {
        $this->application('Remaining Job');
        $deleted = $this->application('Deleted Job');
        $otherDeleted = $this->application('Other Deleted Job');

        $this->putJson('/api/uploads/'.$deleted->id.'/hide')->assertOk();
        $this->putJson('/api/uploads/'.$otherDeleted->id.'/hide')->assertOk();

        $this->submit('New Job')->assertCreated();
        $this->assertSame(2, $this->currentCount());
        $this->assertSame(4, Upload::where('job_seeker_id', $this->jobSeeker->id)->applications()->count());
    }

    public function test_three_current_applications_still_enforce_the_limit(): void
    {
        foreach (['First Job', 'Second Job', 'Third Job'] as $title) {
            $this->application($title);
        }
        $this->application('Deleted Job', ['job_seeker_hidden' => true, 'evaluation_status' => 'cancelled']);

        $this->submit('Fourth Job')->assertUnprocessable()->assertJson([
            'message' => 'You can only apply to 3 jobs.',
        ]);
    }

    public function test_a_deleted_application_does_not_prevent_reapplying_to_that_job(): void
    {
        $this->application('Reapply Job', ['job_seeker_hidden' => true, 'evaluation_status' => 'cancelled']);

        $this->submit('Reapply Job')->assertCreated();
        $this->assertSame(1, $this->currentCount());
    }

    public function test_a_current_application_still_blocks_duplicate_applications(): void
    {
        $this->application('Existing Job');

        $this->submit('Existing Job')->assertUnprocessable()->assertJson([
            'message' => 'You already applied to this job.',
        ]);
    }

    public function test_cancelled_applications_and_profile_pds_do_not_use_slots(): void
    {
        $this->application('Cancelled Job', ['evaluation_status' => 'cancelled']);
        $this->application('Hidden Job', ['job_seeker_hidden' => true]);
        $this->application(null);
        $this->application('Legacy Current Job', ['evaluation_status' => null]);

        $this->assertSame(1, $this->currentCount());
        $this->submit('Another Job')->assertCreated();
        $this->assertSame(2, $this->currentCount());
    }

    private function application(?string $title, array $attributes = []): Upload
    {
        return Upload::create(array_merge([
            'job_seeker_id' => $this->jobSeeker->id,
            'name' => $this->jobSeeker->full_name,
            'email' => $this->jobSeeker->email,
            'applied_job_title' => $title,
            'job_seeker_hidden' => false,
            'evaluation_status' => 'pending',
            'uploaded_at' => now(),
        ], $attributes));
    }

    private function currentCount(): int
    {
        return Upload::query()->currentApplications()->where('job_seeker_id', $this->jobSeeker->id)->count();
    }

    private function submit(string $title): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/upload', [
            'file' => UploadedFile::fake()->create('pds.pdf', 1, 'application/pdf'),
            'name' => $this->jobSeeker->full_name,
            'email' => $this->jobSeeker->email,
            'jobSeekerId' => $this->jobSeeker->id,
            'appliedJobTitle' => $title,
        ]);
    }
}
