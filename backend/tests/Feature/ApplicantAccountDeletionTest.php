<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\ApplicationRating;
use App\Models\Archive;
use App\Models\Education;
use App\Models\Experience;
use App\Models\Job;
use App\Models\JobSeeker;
use App\Models\SupportingFile;
use App\Models\Upload;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ApplicantAccountDeletionTest extends TestCase
{
    use DatabaseTransactions;

    private JobSeeker $jobSeeker;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        Storage::fake('local');
        $this->jobSeeker = $this->newJobSeeker();
    }

    /** @dataProvider applicationStates */
    public function test_accounts_with_application_records_cannot_be_deleted(?string $status, bool $hidden): void
    {
        $upload = $this->upload([
            'applied_job_title' => 'Administrative Officer',
            'evaluation_status' => $status,
            'job_seeker_hidden' => $hidden,
            'file_path' => 'integrity/application.txt',
        ]);
        Storage::disk('local')->put('integrity/application.txt', 'Application document');
        $archiveCount = Archive::count();
        $logCount = ActivityLog::where('event', 'job_seeker.deleted')->count();

        $this->deleteAccount()->assertStatus(409)->assertJson([
            'code' => 'APPLICANT_HAS_LINKED_RECORDS',
            'message' => JobSeeker::DELETION_BLOCK_REASON,
        ]);

        $this->assertDatabaseHas('job_seekers', ['id' => $this->jobSeeker->id]);
        $this->assertDatabaseHas('uploads', ['id' => $upload->id, 'job_seeker_id' => $this->jobSeeker->id]);
        $this->assertSame($archiveCount, Archive::count());
        $this->assertSame($logCount, ActivityLog::where('event', 'job_seeker.deleted')->count());
        Storage::disk('local')->assertExists('integrity/application.txt');
    }

    public static function applicationStates(): array
    {
        return [
            'legacy application' => [null, false],
            'pending' => ['pending', false],
            'reviewed' => ['reviewed', false],
            'shortlisted' => ['shortlisted', false],
            'interview' => ['interview', false],
            'hired history' => ['hired', false],
            'rejected history' => ['rejected', false],
            'deleted from dashboard' => ['cancelled', true],
        ];
    }

    public function test_an_application_linked_by_job_id_without_a_title_is_protected(): void
    {
        $job = Job::create(['title' => 'Integrity Job '.Str::uuid(), 'description' => 'Application integrity test.']);
        $this->upload(['job_id' => $job->id]);

        $this->deleteAccount()->assertStatus(409);
    }

    public function test_linked_evaluation_ratings_are_preserved_even_without_an_application_title(): void
    {
        $upload = $this->upload();
        $rating = ApplicationRating::create(['upload_id' => $upload->id, 'rater_name' => 'Board Member']);

        $this->deleteAccount()->assertStatus(409);
        $this->assertDatabaseHas('application_ratings', ['id' => $rating->id, 'upload_id' => $upload->id]);
        $this->assertDatabaseHas('uploads', ['id' => $upload->id, 'job_seeker_id' => $this->jobSeeker->id]);
    }

    /** @dataProvider processFields */
    public function test_recruitment_process_records_without_titles_are_protected(string $field, mixed $value): void
    {
        $this->upload([$field => $value]);

        $this->deleteAccount()->assertStatus(409);
    }

    public static function processFields(): array
    {
        return [
            'evaluation' => ['evaluation_started_at', '2026-10-18 10:00:00'],
            'interview' => ['interview_date', '2026-10-20'],
            'demonstration' => ['demonstration_date', '2026-10-21'],
            'examination' => ['examination_date', '2026-10-22'],
            'zero exam score' => ['examination_score', 0],
            'evaluation status' => ['evaluation_status', 'for_evaluation'],
        ];
    }

    public function test_supporting_documents_connected_to_an_upload_block_account_deletion(): void
    {
        $upload = $this->upload();
        $file = SupportingFile::create(['job_seeker_id' => $this->jobSeeker->id, 'doc_type' => 'certificate']);
        $file->upload_id = $upload->id;
        $file->save();

        $this->deleteAccount()->assertStatus(409);
        $this->assertDatabaseHas('job_seeker_supporting_files', ['id' => $file->id, 'upload_id' => $upload->id]);
    }

    public function test_user_list_exposes_why_deletion_is_disabled(): void
    {
        $this->upload(['applied_job_title' => 'Administrative Officer']);
        $users = $this->getJson('/api/job-seekers/all')->assertOk()->json();
        $user = collect($users)->firstWhere('id', $this->jobSeeker->id);

        $this->assertFalse($user['can_delete']);
        $this->assertSame(JobSeeker::DELETION_BLOCK_REASON, $user['deletion_block_reason']);
    }

    public function test_a_new_application_blocks_deletion_even_if_the_user_list_was_stale(): void
    {
        $this->getJson('/api/job-seekers/'.$this->jobSeeker->id)->assertOk()
            ->assertJsonPath('jobSeeker.can_delete', true);
        $this->upload(['applied_job_title' => 'New Application']);

        $this->deleteAccount()->assertStatus(409);
    }

    public function test_model_deletion_cannot_bypass_the_dependency_check(): void
    {
        $this->upload(['applied_job_title' => 'Administrative Officer']);
        try {
            $this->jobSeeker->delete();
            $this->fail('Deletion should have been blocked.');
        } catch (ValidationException $exception) {
            $this->assertSame([JobSeeker::DELETION_BLOCK_REASON], $exception->errors()['account']);
        }
        $this->assertDatabaseHas('job_seekers', ['id' => $this->jobSeeker->id]);
    }

    public function test_an_account_without_recruitment_records_can_still_be_deleted(): void
    {
        Education::create(['job_seeker_id' => $this->jobSeeker->id, 'school_name' => 'School']);
        Experience::create(['job_seeker_id' => $this->jobSeeker->id, 'position' => 'Previous Work']);
        $other = $this->newJobSeeker();
        Upload::create(['job_seeker_id' => $other->id, 'applied_job_title' => 'Other Applicant Job']);

        $this->deleteAccount()->assertOk();

        $this->assertDatabaseMissing('job_seekers', ['id' => $this->jobSeeker->id]);
        $this->assertDatabaseMissing('job_seeker_education', ['job_seeker_id' => $this->jobSeeker->id]);
        $this->assertDatabaseMissing('job_seeker_experience', ['job_seeker_id' => $this->jobSeeker->id]);
        $this->assertDatabaseHas('job_seekers', ['id' => $other->id]);
        $this->assertDatabaseHas('archives', ['record_type' => 'job_seeker', 'record_id' => $this->jobSeeker->id]);
    }

    private function newJobSeeker(): JobSeeker
    {
        return JobSeeker::create([
            'full_name' => 'Account Integrity Applicant',
            'email' => 'account-integrity-'.Str::uuid().'@example.com',
            'password' => 'test-password',
        ]);
    }

    private function upload(array $attributes = []): Upload
    {
        return Upload::create(array_merge([
            'job_seeker_id' => $this->jobSeeker->id,
            'evaluation_status' => null,
            'uploaded_at' => now(),
        ], $attributes));
    }

    private function deleteAccount(): \Illuminate\Testing\TestResponse
    {
        return $this->withHeaders(['X-Actor-Role' => 'personnel', 'X-Actor-Name' => 'HR Personnel'])
            ->deleteJson('/api/job-seekers/'.$this->jobSeeker->id);
    }
}
