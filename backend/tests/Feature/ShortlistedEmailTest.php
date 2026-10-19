<?php

namespace Tests\Feature;

use App\Models\Employer;
use App\Models\Upload;
use App\Models\User;
use App\Notifications\ApplicationShortlistedNotification;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class ShortlistedEmailTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        config(['mail.default' => 'smtp']);
        Notification::fake();
    }

    public function test_shortlisting_sends_once_and_reports_mail_server_acceptance(): void
    {
        $upload = $this->application('reviewed');
        $this->putJson('/api/uploads/'.$upload->id.'/status', ['status' => 'shortlisted'])
            ->assertOk()->assertJsonPath('shortlistEmail.status', 'accepted');
        $this->putJson('/api/uploads/'.$upload->id.'/status', ['status' => 'shortlisted'])->assertOk();
        Notification::assertSentOnDemand(ApplicationShortlistedNotification::class, fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'applicant@example.com');
        Notification::assertCount(1);
        $this->assertSame('shortlisted', $upload->fresh()->evaluation_status);
    }

    public function test_spam_rejection_is_reported_without_losing_the_shortlisted_status(): void
    {
        Notification::swap(\Mockery::mock(\Illuminate\Contracts\Notifications\Dispatcher::class));
        Notification::shouldReceive('send')->once()->andThrow(new RuntimeException('550 This message was classified as SPAM'));
        $upload = $this->application('reviewed');
        $this->putJson('/api/uploads/'.$upload->id.'/status', ['status' => 'shortlisted'])
            ->assertOk()->assertJsonPath('shortlistEmail.status', 'failed')
            ->assertJsonPath('shortlistEmail.message', 'The mail server rejected the shortlisting email as spam. Please check Email Deliverability in cPanel before resending.');
        $this->assertSame('shortlisted', $upload->fresh()->evaluation_status);
    }

    public function test_personnel_can_resend_without_changing_the_application_status(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $upload = $this->application('shortlisted');
        $this->postJson('/api/uploads/'.$upload->id.'/shortlist-email')
            ->assertOk()->assertJsonPath('shortlistEmail.status', 'accepted');
        Notification::assertCount(1);
        $this->assertSame('shortlisted', $upload->fresh()->evaluation_status);
    }

    public function test_resending_requires_a_personnel_account(): void
    {
        $upload = $this->application('shortlisted');
        $this->postJson('/api/uploads/'.$upload->id.'/shortlist-email')->assertUnauthorized();
        $board = Employer::create(['company_name' => 'Board', 'email' => Str::uuid().'@example.com', 'password' => 'test-password', 'position_type' => 'board']);
        $this->actingAs($board, 'employer')->postJson('/api/uploads/'.$upload->id.'/shortlist-email')->assertForbidden();
        Notification::assertNothingSent();
    }

    public function test_logging_only_mailer_never_reports_a_sent_notification(): void
    {
        config(['mail.default' => 'log']);
        $upload = $this->application('reviewed');
        $this->putJson('/api/uploads/'.$upload->id.'/status', ['status' => 'shortlisted'])
            ->assertOk()->assertJsonPath('shortlistEmail.status', 'failed');
        Notification::assertNothingSent();
    }

    public function test_only_shortlisted_applications_can_be_resent(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $upload = $this->application('hired');
        $this->postJson('/api/uploads/'.$upload->id.'/shortlist-email')->assertUnprocessable();
        Notification::assertNothingSent();
    }

    private function application(string $status): Upload
    {
        return Upload::create(['name' => 'Email Test Applicant', 'email' => 'applicant@example.com', 'applied_job_title' => 'Instructor I', 'evaluation_status' => $status, 'original_name' => 'pds.txt', 'file_path' => 'email-test/pds.txt', 'mime_type' => 'text/plain', 'uploaded_at' => now()]);
    }
}
