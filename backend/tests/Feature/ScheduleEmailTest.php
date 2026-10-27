<?php

namespace Tests\Feature;

use App\Models\Employer;
use App\Models\JobSeeker;
use App\Models\Upload;
use App\Models\User;
use App\Notifications\ApplicationScheduleNotification;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class ScheduleEmailTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        config(['mail.default' => 'smtp']);
        Notification::fake();
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
    }

    public static function stages(): array
    {
        return [['interview'], ['demonstration']];
    }

    /** @dataProvider stages */
    public function test_saving_schedule_emails_the_job_seeker_and_rescheduling_sends_updated_details(string $stage): void
    {
        $seeker = JobSeeker::create(['full_name' => 'Schedule Applicant', 'email' => Str::uuid().'@example.com', 'password' => 'test-password']);
        $upload = $this->application(['job_seeker_id' => $seeker->id]);
        $payload = $this->schedule($stage);
        $this->putJson($this->url($upload, $stage), $payload)->assertOk()->assertJsonPath($stage.'Email.status', 'accepted');
        Notification::assertSentOnDemand(ApplicationScheduleNotification::class, function ($notification, $channels, $notifiable) use ($stage, $seeker) {
            $message = $notification->toMail($notifiable);
            $text = implode("\n", $message->introLines);
            $this->assertStringContainsString('October 30, 2030', $text);
            $this->assertStringContainsString('9:30 AM (Philippine Time)', $text);
            $this->assertStringContainsString('Room 101', $text);
            $this->assertStringContainsString('Bring your documents.', $text);
            $this->assertStringContainsString('Instructor I', $text);
            $this->assertStringContainsString('October 30, 2030', (string) $message->render());
            return $notification->stage === $stage && $notifiable->routes['mail'] === $seeker->email;
        });
        $this->putJson($this->url($upload, $stage), $payload)->assertOk()->assertJsonPath($stage.'Email.status', 'unchanged');
        Notification::assertCount(1);
        $payload[$stage.'Date'] = '2030-11-01';
        $this->putJson($this->url($upload, $stage), $payload)->assertOk()->assertJsonPath($stage.'Email.status', 'accepted');
        Notification::assertCount(2);
        $payload[$stage.'Time'] = '14:00';
        $this->putJson($this->url($upload, $stage), $payload)->assertOk()->assertJsonPath($stage.'Email.status', 'accepted');
        Notification::assertCount(3);
    }

    /** @dataProvider stages */
    public function test_email_failure_preserves_schedule_and_saving_again_retries(string $stage): void
    {
        Notification::swap(\Mockery::mock(\Illuminate\Contracts\Notifications\Dispatcher::class));
        Notification::shouldReceive('send')->once()->andThrow(new RuntimeException('Mail server unavailable'));
        $upload = $this->application();
        $this->putJson($this->url($upload, $stage), $this->schedule($stage))->assertOk()->assertJsonPath($stage.'Email.status', 'failed');
        $this->assertSame('2030-10-30', $upload->fresh()->getAttribute($stage.'_date')->toDateString());
        $this->assertNull($upload->fresh()->getAttribute($stage.'_email_signature'));
        Notification::fake();
        $this->putJson($this->url($upload, $stage), $this->schedule($stage))->assertOk()->assertJsonPath($stage.'Email.status', 'accepted');
        Notification::assertCount(1);
    }

    /** @dataProvider stages */
    public function test_invalid_recipient_and_unconfigured_mail_are_reported_without_claiming_delivery(string $stage): void
    {
        $upload = $this->application(['email' => 'invalid']);
        $this->putJson($this->url($upload, $stage), $this->schedule($stage))->assertOk()->assertJsonPath($stage.'Email.status', 'failed');
        $upload->update(['email' => 'applicant@example.com']);
        config(['mail.default' => 'log']);
        $this->putJson($this->url($upload, $stage), $this->schedule($stage))->assertOk()->assertJsonPath($stage.'Email.status', 'failed');
        Notification::assertNothingSent();
    }

    /** @dataProvider stages */
    public function test_unauthorized_and_invalid_schedule_requests_do_not_send_email(string $stage): void
    {
        $upload = $this->application();
        $this->putJson($this->url($upload, $stage), [$stage.'Date' => 'not-a-date'])->assertUnprocessable();
        Auth::guard('web')->logout();
        $this->putJson($this->url($upload, $stage), $this->schedule($stage))->assertUnauthorized();
        $board = Employer::create(['company_name' => 'Board', 'email' => Str::uuid().'@example.com', 'password' => 'test-password', 'position_type' => 'board']);
        $this->actingAs($board, 'employer')->putJson($this->url($upload, $stage), $this->schedule($stage))->assertForbidden();
        Notification::assertNothingSent();
        $this->assertNull($upload->fresh()->getAttribute($stage.'_date'));
    }

    public function test_interview_and_demonstration_are_not_deduplicated_against_each_other(): void
    {
        $upload = $this->application();
        foreach (['interview', 'demonstration'] as $stage) {
            $this->putJson($this->url($upload, $stage), [$stage.'Date' => '2030-10-30'])->assertOk()->assertJsonPath($stage.'Email.status', 'accepted');
        }
        Notification::assertCount(2);
        Notification::assertSentOnDemand(ApplicationScheduleNotification::class, function ($notification, $channels, $notifiable) {
            $text = implode("\n", $notification->toMail($notifiable)->introLines);
            return str_contains($text, 'Time: To be confirmed') && str_contains($text, 'Venue: To be confirmed');
        });
    }

    private function application(array $attributes = []): Upload
    {
        return Upload::create(array_merge(['name' => 'Schedule Applicant', 'email' => 'applicant@example.com',
            'applied_job_title' => 'Instructor I', 'evaluation_status' => 'shortlisted', 'original_name' => 'pds.txt',
            'file_path' => 'schedule-test/pds.txt', 'mime_type' => 'text/plain', 'uploaded_at' => now()], $attributes));
    }

    private function schedule(string $stage): array
    {
        return [$stage.'Date' => '2030-10-30', $stage.'Time' => '09:30', $stage.'Place' => 'Room 101',
            $stage.'PreparationNotes' => 'Bring your documents.'];
    }

    private function url(Upload $upload, string $stage): string
    {
        return '/api/uploads/'.$upload->id.'/'.$stage.'-date';
    }
}
