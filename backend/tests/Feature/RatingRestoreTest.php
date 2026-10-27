<?php

namespace Tests\Feature;

use App\Models\ApplicationRating;
use App\Models\Archive;
use App\Models\Upload;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class RatingRestoreTest extends TestCase
{
    use DatabaseTransactions;

    public function test_cancelled_ratings_can_be_restored_with_scores_remarks_and_raters(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $upload = $this->application();
        $rating = ApplicationRating::create([
            'upload_id' => $upload->id, 'rater_name' => 'Board Member', 'rater_email' => 'board@example.com',
            'scores' => ['Knowledge' => 4, 'Skills' => 5], 'remarks' => 'Good interview',
            'total_score' => 9, 'percentage_score' => 90,
        ]);
        $this->putJson('/api/uploads/'.$upload->id.'/evaluation/cancel')->assertOk();
        $archive = Archive::where('record_type', 'rating')->where('record_id', $upload->id)->latest('id')->firstOrFail();
        $this->postJson($this->url($archive))->assertOk();
        $restored = $upload->ratings()->sole();
        foreach (['rater_name', 'rater_email', 'scores', 'remarks', 'total_score', 'percentage_score'] as $field) {
            $this->assertSame($rating->$field, $restored->$field);
        }
        $this->assertEquals($rating->created_at, $restored->created_at);
        $this->assertSame('rated', $upload->fresh()->evaluation_status);
        $this->assertNotNull($upload->fresh()->evaluation_started_at);
        $this->assertDatabaseMissing('archives', ['id' => $archive->id]);
        $this->assertDatabaseHas('activity_logs', ['event' => 'rating.restored', 'subject_id' => $upload->id]);
        $this->postJson($this->url($archive))->assertNotFound();
    }

    public function test_existing_ratings_are_not_overwritten(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $upload = $this->application();
        $archive = $this->archive($upload);
        ApplicationRating::create(['upload_id' => $upload->id, 'scores' => ['Skills' => 5], 'total_score' => 5, 'percentage_score' => 100]);
        $this->postJson($this->url($archive))->assertConflict();
        $this->assertCount(1, $upload->ratings()->get());
        $this->assertDatabaseHas('archives', ['id' => $archive->id]);
    }

    public function test_missing_application_and_invalid_archives_are_retained(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $upload = $this->application();
        $archive = $this->archive($upload);
        $upload->delete();
        $this->postJson($this->url($archive))->assertUnprocessable();
        $this->assertDatabaseHas('archives', ['id' => $archive->id]);
        $archive->update(['record_type' => 'job']);
        $this->postJson($this->url($archive))->assertUnprocessable();
    }

    public function test_restore_requires_authenticated_personnel(): void
    {
        $archive = $this->archive($this->application());
        $this->postJson($this->url($archive), [], ['X-Actor-Role' => 'admin'])->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => 'board']), 'web');
        $this->postJson($this->url($archive))->assertForbidden();
        $this->assertDatabaseHas('archives', ['id' => $archive->id]);
    }

    public function test_invalid_rating_rolls_back_the_whole_restore(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $upload = $this->application();
        $archive = $this->archive($upload);
        $archive->update(['data' => ['ratings' => [['scores' => ['Skills' => 4]], ['remarks' => 'Missing scores']]]]);
        $this->postJson($this->url($archive))->assertUnprocessable();
        $this->assertCount(0, $upload->ratings()->get());
        $this->assertDatabaseHas('archives', ['id' => $archive->id]);
    }

    private function application(): Upload
    {
        return Upload::create([
            'name' => 'Restore Applicant', 'email' => 'restore@example.com', 'applied_job_title' => 'Officer',
            'evaluation_status' => 'interview', 'original_name' => 'pds.pdf', 'file_path' => 'test/pds.pdf',
            'mime_type' => 'application/pdf', 'uploaded_at' => now(),
        ]);
    }

    private function archive(Upload $upload): Archive
    {
        return Archive::create([
            'record_type' => 'rating', 'record_id' => $upload->id, 'title' => $upload->name, 'deleted_at' => now(),
            'data' => ['ratings' => [['scores' => ['Skills' => 4], 'totalScore' => 4, 'percentageScore' => 80]]],
        ]);
    }

    private function url(Archive $archive): string
    {
        return '/api/archives/'.$archive->id.'/restore-rating';
    }
}
