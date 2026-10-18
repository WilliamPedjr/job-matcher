<?php

namespace Tests\Feature;

use App\Models\Job;
use App\Models\JobSeeker;
use App\Models\Upload;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ExperienceSkillsTest extends TestCase
{
    use DatabaseTransactions;

    private JobSeeker $jobSeeker;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $this->jobSeeker = JobSeeker::create([
            'full_name' => 'Skills Applicant',
            'email' => 'skills-'.Str::uuid().'@example.com',
            'password' => 'test-password',
        ]);
        Storage::fake('local');
    }

    public function test_work_and_training_skills_are_saved_and_combined_without_duplicates(): void
    {
        $work = $this->addRecord([' Data   Analysis ', 'data analysis', 'Teamwork']);
        $training = $this->addRecord(['teamwork', 'Public Speaking'], true);

        $this->assertSame(['Data Analysis', 'Teamwork'], $work['skills']);
        $this->assertSame(['teamwork', 'Public Speaking'], $training['skills']);
        $this->getJson('/api/job-seekers/'.$this->jobSeeker->id)->assertOk()
            ->assertJsonPath('jobSeeker.skills', ['Data Analysis', 'Teamwork', 'Public Speaking'])
            ->assertJsonPath('experiences.0.skills', ['Data Analysis', 'Teamwork'])
            ->assertJsonPath('experiences.1.skills', ['teamwork', 'Public Speaking']);
    }

    public function test_editing_and_deleting_records_rebuilds_the_combined_list(): void
    {
        $work = $this->addRecord(['Data Analysis', 'Teamwork']);
        $training = $this->addRecord(['Teamwork', 'Public Speaking'], true);

        $this->putJson($this->recordUrl($work['id']), ['skills' => ['Microsoft Excel']])->assertOk();
        $this->assertProfileSkills(['Microsoft Excel', 'Teamwork', 'Public Speaking']);
        $this->deleteJson($this->recordUrl($training['id']))->assertOk();
        $this->assertProfileSkills(['Microsoft Excel']);
        $this->deleteJson($this->recordUrl($work['id']))->assertOk();
        $this->assertProfileSkills([]);
    }

    public function test_omitting_skills_preserves_them_and_empty_array_clears_them(): void
    {
        $work = $this->addRecord(['Data Analysis']);

        $this->putJson($this->recordUrl($work['id']), ['position' => 'New title'])->assertOk()
            ->assertJsonPath('skills', ['Data Analysis']);
        $this->putJson($this->recordUrl($work['id']), ['skills' => []])->assertOk()
            ->assertJsonPath('skills', []);
        $this->assertProfileSkills([]);
    }

    public function test_invalid_skills_are_rejected(): void
    {
        $base = ['start_date' => '2020-01-01', 'end_date' => '2020-12-31'];
        foreach (['not an array', [str_repeat('x', 101)], [['nested']], array_fill(0, 101, 'Skill')] as $skills) {
            $this->postJson($this->recordUrl(), $base + ['skills' => $skills])->assertUnprocessable();
        }
        $this->assertProfileSkills([]);
    }

    public function test_combined_skills_drive_preview_batch_and_application_matching(): void
    {
        $job = Job::create([
            'title' => 'Skills Job '.Str::uuid(), 'description' => 'Data analysis and presentation work.',
            'status' => 'active', 'minimum_experience_years' => 0,
            'minimum_education' => 'None required', 'eligibility' => 'None required',
            'required_skills' => 'Data Analysis, Public Speaking',
        ]);
        // PDS text alone must not add a skill to the compiled profile list.
        $text = "Professional Summary\nApplicant with administrative experience.\nSkills\nPublic Speaking";
        Storage::disk('local')->put('skills-test/pds.txt', $text);
        Upload::create([
            'job_seeker_id' => $this->jobSeeker->id, 'file_path' => 'skills-test/pds.txt',
            'original_name' => 'pds.txt', 'mime_type' => 'text/plain', 'uploaded_at' => now(),
        ]);
        $url = '/api/job-seekers/'.$this->jobSeeker->id.'/resume/match?'.http_build_query(['jobId' => $job->id]);
        $this->getJson($url)->assertOk()->assertJsonPath('analysis.skills_match_score', 0);

        $work = $this->addRecord(['Data Analysis']);
        $training = $this->addRecord(['Public Speaking', 'data analysis'], true);
        $this->getJson($url)->assertOk()->assertJsonPath('analysis.skills_match_score', 100)
            ->assertJsonPath('analysis.matched_skills', ['Data Analysis', 'Public Speaking'])
            ->assertJsonPath('analysis.profile_skills', ['Data Analysis', 'Public Speaking']);
        $this->postJson('/api/job-seekers/'.$this->jobSeeker->id.'/resume/match/batch', [
            'jobIds' => [$job->id], 'jobTitles' => [$job->title],
        ])->assertOk()->assertJsonPath('matches.0.score', 100);

        $this->postJson('/api/upload', [
            'file' => UploadedFile::fake()->createWithContent('pds.txt', $text),
            'name' => $this->jobSeeker->full_name, 'email' => $this->jobSeeker->email,
            'jobSeekerId' => $this->jobSeeker->id, 'jobId' => $job->id,
        ])->assertCreated()->assertJsonPath('skills_match_score', 100)
            ->assertJsonPath('resume_summary.skills', ['Data Analysis', 'Public Speaking']);

        $this->putJson($this->recordUrl($training['id']), ['skills' => []])->assertOk();
        $this->getJson($url)->assertOk()->assertJsonPath('analysis.skills_match_score', 50);
        $this->deleteJson($this->recordUrl($work['id']))->assertOk();
        $this->getJson($url)->assertOk()->assertJsonPath('analysis.skills_match_score', 0);
    }

    private function addRecord(array $skills, bool $training = false): array
    {
        return $this->postJson($this->recordUrl(), [
            'position' => $training ? 'Presentation Workshop' : 'Administrative Officer',
            'company_name' => 'Company', 'start_date' => '2020-01-01', 'end_date' => '2020-12-31',
            'description' => $training ? 'Record Type: Training' : 'Record Type: Work Experience',
            'skills' => $skills,
        ])->assertCreated()->json();
    }

    private function recordUrl(?int $id = null): string
    {
        return '/api/job-seekers/'.$this->jobSeeker->id.'/experience'.($id ? '/'.$id : '');
    }

    private function assertProfileSkills(array $skills): void
    {
        $this->getJson('/api/job-seekers/'.$this->jobSeeker->id)->assertOk()->assertJsonPath('jobSeeker.skills', $skills);
    }
}
