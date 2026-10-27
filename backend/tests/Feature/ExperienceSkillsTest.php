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

    public function test_removing_a_skill_clears_every_source_and_preserves_other_skills(): void
    {
        $work = $this->addRecord([' Management ', 'C++']);
        $training = $this->addRecord(['MANAGEMENT', 'C#'], true);
        $this->jobSeeker->update(['manual_skills' => ['management', 'Communication']]);
        $url = '/api/job-seekers/'.$this->jobSeeker->id;
        $this->actingAs($this->jobSeeker, 'job_seeker')->deleteJson($url.'/skills', ['skill' => ' Management '])
            ->assertOk()->assertJsonPath('jobSeeker.skills', ['Communication', 'C++', 'C#'])
            ->assertJsonPath('jobSeeker.manual_skills', ['Communication']);
        $this->assertDatabaseHas('job_seeker_experience', ['id' => $work['id'], 'position' => 'Administrative Officer']);
        $this->getJson($url)->assertOk()->assertJsonPath('experiences.0.skills', ['C++'])
            ->assertJsonPath('experiences.1.skills', ['C#']);
        $this->assertProfileSkills(['Communication', 'C++', 'C#']);
        $this->deleteJson($url.'/skills', ['skill' => 'C++'])->assertOk();
        $this->assertProfileSkills(['Communication', 'C#']);
        $this->putJson($url, ['manual_skills' => ['Communication', 'C++']])->assertOk();
        $this->assertProfileSkills(['Communication', 'C++', 'C#']);
    }

    public function test_skill_removal_requires_the_owner_and_valid_input(): void
    {
        $this->addRecord(['Management']);
        $url = '/api/job-seekers/'.$this->jobSeeker->id.'/skills';
        $this->deleteJson($url, ['skill' => 'Management'])->assertUnauthorized();
        $other = JobSeeker::create(['full_name' => 'Other', 'email' => Str::uuid().'@example.com', 'password' => 'test-password']);
        $this->actingAs($other, 'job_seeker')->deleteJson($url, ['skill' => 'Management'])->assertForbidden();
        $this->actingAs($this->jobSeeker, 'job_seeker');
        foreach (['', [], str_repeat('x', 101)] as $skill) {
            $this->deleteJson($url, ['skill' => $skill])->assertUnprocessable();
        }
        $this->assertProfileSkills(['Management']);
    }

    public function test_removed_learned_skill_no_longer_counts_for_matching(): void
    {
        $job = Job::create([
            'title' => 'Removal Skills Job '.Str::uuid(), 'description' => 'Administrative work.',
            'status' => 'active', 'minimum_experience_years' => 0,
            'minimum_education' => 'None required', 'eligibility' => 'None required',
            'required_skills' => 'Management, Teaching',
        ]);
        $this->addRecord(['Management', 'Teaching']);
        $this->addRecord(['management'], true);
        Storage::disk('local')->put('skills-test/removal.txt', "Professional Summary\nAdministrative applicant.");
        Upload::create([
            'job_seeker_id' => $this->jobSeeker->id, 'file_path' => 'skills-test/removal.txt',
            'original_name' => 'pds.txt', 'mime_type' => 'text/plain', 'uploaded_at' => now(),
        ]);
        $url = '/api/job-seekers/'.$this->jobSeeker->id;
        $matchUrl = $url.'/resume/match?jobId='.$job->id;
        $this->getJson($matchUrl)->assertOk()->assertJsonPath('analysis.skills_match_score', 100);
        $this->actingAs($this->jobSeeker, 'job_seeker')->deleteJson($url.'/skills', ['skill' => 'Management'])->assertOk();
        $this->getJson($matchUrl)->assertOk()->assertJsonPath('analysis.skills_match_score', 50)
            ->assertJsonPath('analysis.profile_skills', ['Teaching']);
    }

    public function test_manual_skills_persist_merge_and_can_be_removed_independently(): void
    {
        $url = '/api/job-seekers/'.$this->jobSeeker->id;
        $this->addRecord(['Teamwork', 'Public Speaking']);
        $this->putJson($url, ['manual_skills' => [' Administrative  ', 'Management', 'management', 'Teamwork']])
            ->assertOk()->assertJsonPath('manual_skills', ['Administrative', 'Management', 'Teamwork']);
        $this->assertProfileSkills(['Administrative', 'Management', 'Teamwork', 'Public Speaking']);
        $this->putJson($url, ['address' => 'New address'])->assertOk();
        $this->getJson($url)->assertOk()
            ->assertJsonPath('jobSeeker.manual_skills', ['Administrative', 'Management', 'Teamwork']);
        $this->putJson($url, ['manual_skills' => []])->assertOk();
        $this->assertProfileSkills(['Teamwork', 'Public Speaking']);
        foreach (['invalid', null, [''], [str_repeat('x', 101)], [['nested']], array_fill(0, 101, 'Skill')] as $skills) {
            $this->putJson($url, ['manual_skills' => $skills])->assertUnprocessable();
        }
    }

    public function test_manual_skills_drive_preview_batch_and_submitted_application(): void
    {
        $job = Job::create([
            'title' => 'Manual Skills Job '.Str::uuid(), 'description' => 'Administrative work.',
            'status' => 'active', 'minimum_experience_years' => 0,
            'minimum_education' => 'None required', 'eligibility' => 'None required',
            'required_skills' => 'Management, Academic Writing',
        ]);
        $text = "Professional Summary\nApplicant with administrative experience.";
        Storage::disk('local')->put('skills-test/manual-pds.txt', $text);
        Upload::create([
            'job_seeker_id' => $this->jobSeeker->id, 'file_path' => 'skills-test/manual-pds.txt',
            'original_name' => 'pds.txt', 'mime_type' => 'text/plain', 'uploaded_at' => now(),
        ]);
        $url = '/api/job-seekers/'.$this->jobSeeker->id;
        $matchUrl = $url.'/resume/match?'.http_build_query(['jobId' => $job->id]);
        $this->getJson($matchUrl)->assertOk()->assertJsonPath('analysis.skills_match_score', 0);
        $this->putJson($url, ['manual_skills' => ['Management', 'Academic Writing']])->assertOk();
        $this->getJson($matchUrl)->assertOk()->assertJsonPath('analysis.skills_match_score', 100)
            ->assertJsonPath('analysis.profile_skills', ['Management', 'Academic Writing']);
        $this->postJson($url.'/resume/match/batch', [
            'jobIds' => [$job->id], 'jobTitles' => [$job->title],
        ])->assertOk()->assertJsonPath('matches.0.score', 100);
        $this->postJson('/api/upload', [
            'file' => UploadedFile::fake()->createWithContent('pds.txt', $text),
            'name' => $this->jobSeeker->full_name, 'email' => $this->jobSeeker->email,
            'jobSeekerId' => $this->jobSeeker->id, 'jobId' => $job->id,
        ])->assertCreated()->assertJsonPath('skills_match_score', 100)
            ->assertJsonPath('resume_summary.skills', ['Management', 'Academic Writing']);
        $this->putJson($url, ['manual_skills' => []])->assertOk();
        $this->getJson($matchUrl)->assertOk()->assertJsonPath('analysis.skills_match_score', 0);
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
