<?php

namespace Tests\Feature;

use App\Models\JobSeeker;
use App\Notifications\JobSeekerEmailVerificationNotification;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class ResendVerificationTest extends TestCase
{
    use DatabaseTransactions;

    private const URL = '/api/job-seekers/email-verification/resend';

    protected function setUp(): void
    {
        parent::setUp();
        config(['mail.default' => 'smtp']);
        Notification::fake();
        $this->travelTo(now()->startOfSecond());
    }

    public function test_resending_preserves_the_existing_verification_link(): void
    {
        $account = $this->account();
        $token = $account->email_verification_token;
        $this->postJson(self::URL, ['email' => strtoupper($account->email)])->assertStatus(202);
        Notification::assertSentTo($account, JobSeekerEmailVerificationNotification::class, function ($notification) use ($account, $token) {
            return $notification->toMail($account)->actionUrl === url('/job-seeker/verify-email/'.$token);
        });
        $this->assertSame($token, $account->fresh()->email_verification_token);
        $this->assertSame(now()->toDateTimeString(), $account->fresh()->email_verification_sent_at->toDateTimeString());
        $this->get('/job-seeker/verify-email/'.$token)->assertRedirect('/job-seeker/email-verification?status=verified');
        $this->assertNotNull($account->fresh()->email_verified_at);
    }

    public function test_cooldown_is_enforced_on_the_server_then_allows_resend(): void
    {
        $account = $this->account(['email_verification_sent_at' => now()->subSeconds(30)]);
        $this->postJson(self::URL, ['email' => $account->email])->assertStatus(429)
            ->assertJsonPath('retryAfter', 30)->assertHeader('Retry-After', '30');
        Notification::assertNothingSent();
        $this->travel(30)->seconds();
        $this->postJson(self::URL, ['email' => $account->email])->assertStatus(202);
        $this->postJson(self::URL, ['email' => $account->email])->assertStatus(429);
        Notification::assertCount(1);
    }

    public function test_verified_and_unknown_addresses_do_not_receive_verification_messages(): void
    {
        $account = $this->account(['email_verified_at' => now(), 'email_verification_token' => null]);
        foreach ([$account->email, 'missing-'.Str::uuid().'@example.com'] as $email) {
            $this->postJson(self::URL, ['email' => $email])->assertStatus(202);
        }
        Notification::assertNothingSent();
        $this->assertNull($account->fresh()->email_verification_token);
    }

    public function test_delivery_failure_does_not_start_a_success_cooldown_and_can_be_retried(): void
    {
        $account = $this->account();
        $sentAt = $account->email_verification_sent_at->toDateTimeString();
        Notification::swap(\Mockery::mock(\Illuminate\Contracts\Notifications\Dispatcher::class));
        Notification::shouldReceive('send')->once()->andThrow(new RuntimeException('SMTP unavailable'));
        $this->postJson(self::URL, ['email' => $account->email])->assertStatus(503);
        $this->assertSame($sentAt, $account->fresh()->email_verification_sent_at->toDateTimeString());
        Notification::fake();
        $this->postJson(self::URL, ['email' => $account->email])->assertStatus(202);
        Notification::assertCount(1);
    }

    public function test_unconfigured_mail_and_invalid_input_are_reported(): void
    {
        $account = $this->account();
        $this->postJson(self::URL, ['email' => 'invalid'])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson(self::URL)->assertUnprocessable()->assertJsonValidationErrors('email');
        config(['mail.default' => 'log']);
        $this->postJson(self::URL, ['email' => $account->email])->assertStatus(503);
        Notification::assertNothingSent();
    }

    public function test_unverified_accounts_without_a_token_get_a_valid_link(): void
    {
        $account = $this->account(['email_verification_token' => null, 'email_verification_sent_at' => null]);
        $this->postJson(self::URL, ['email' => $account->email])->assertStatus(202);
        $this->assertNotEmpty($account->fresh()->email_verification_token);
        Notification::assertSentTo($account, JobSeekerEmailVerificationNotification::class);
    }

    public function test_endpoint_limits_repeated_requests_by_ip(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson(self::URL, ['email' => 'unknown@example.com'])->assertStatus(202);
        }
        $this->postJson(self::URL, ['email' => 'unknown@example.com'])->assertStatus(429);
        Notification::assertNothingSent();
    }

    private function account(array $changes = []): JobSeeker
    {
        return JobSeeker::create(array_merge([
            'full_name' => 'Verification Applicant', 'email' => 'verification-'.Str::uuid().'@example.com',
            'password' => 'test-password', 'email_verified_at' => null,
            'email_verification_token' => Str::random(64), 'email_verification_sent_at' => now()->subMinutes(2),
        ], $changes));
    }
}
