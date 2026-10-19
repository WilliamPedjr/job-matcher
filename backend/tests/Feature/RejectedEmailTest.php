<?php

namespace Tests\Feature;

use App\Models\Employer;
use App\Models\Upload;
use App\Models\User;
use App\Notifications\ApplicationRejectedNotification;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class RejectedEmailTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        config(['mail.default' => 'smtp']);
        Notification::fake();
    }

    public function test_rejection_sends_once_to_the_applicant_without_a_shortlisting_email(): void
    {
        $upload = $this->application('reviewed');
        $this->putJson('/api/uploads/'.$upload->id.'/status', ['status' => 'rejected'])
            ->assertOk()->assertJsonPath('rejectionEmail.status', 'accepted')->assertJsonMissingPath('shortlistEmail');
        $this->putJson('/api/uploads/'.$upload->id.'/status', ['status' => 'rejected'])->assertOk();
        Notification::assertSentOnDemand(ApplicationRejectedNotification::class, fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'applicant@example.com');
        Notification::assertCount(1);
        $this->assertSame('rejected', $upload->fresh()->evaluation_status);
    }

    public function test_sending_failure_preserves_rejection_and_reports_the_error(): void
    {
        Notification::swap(\Mockery::mock(\Illuminate\Contracts\Notifications\Dispatcher::class));
        Notification::shouldReceive('send')->once()->andThrow(new RuntimeException('SMTP unavailable'));
        $upload = $this->application('reviewed');
        $this->putJson('/api/uploads/'.$upload->id.'/status', ['status' => 'rejected'])
            ->assertOk()->assertJsonPath('rejectionEmail.status', 'failed');
        $this->assertSame('rejected', $upload->fresh()->evaluation_status);
    }

    public function test_rejection_can_be_resent_by_personnel_without_changing_the_status(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $upload = $this->application('rejected');
        $this->postJson('/api/uploads/'.$upload->id.'/rejection-email')
            ->assertOk()->assertJsonPath('rejectionEmail.status', 'accepted');
        Notification::assertSentOnDemand(ApplicationRejectedNotification::class);
        Notification::assertCount(1);
        $this->assertSame('rejected', $upload->fresh()->evaluation_status);
    }

    public function test_only_personnel_can_resend_and_only_for_rejected_applications(): void
    {
        $upload = $this->application('reviewed');
        $url = '/api/uploads/'.$upload->id.'/rejection-email';
        $this->postJson($url)->assertUnauthorized();
        $board = Employer::create(['company_name' => 'Board', 'email' => Str::uuid().'@example.com', 'password' => 'test-password', 'position_type' => 'board']);
        $this->actingAs($board, 'employer')->postJson($url)->assertForbidden();
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web')->postJson($url)->assertUnprocessable();
        Notification::assertNothingSent();
    }

    public function test_unrelated_status_changes_do_not_send_a_rejection_email(): void
    {
        $upload = $this->application('pending');
        $this->putJson('/api/uploads/'.$upload->id.'/status', ['status' => 'reviewed'])
            ->assertOk()->assertJsonMissingPath('rejectionEmail');
        Notification::assertNothingSent();
    }

    private function application(string $status): Upload
    {
        return Upload::create(['name' => 'Rejection Email Test', 'email' => 'applicant@example.com', 'applied_job_title' => 'Instructor I', 'evaluation_status' => $status, 'original_name' => 'pds.txt', 'file_path' => 'email-test/pds.txt', 'mime_type' => 'text/plain', 'uploaded_at' => now()]);
    }
}
