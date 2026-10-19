<?php

namespace Tests\Unit;

use App\Models\Employer;
use App\Models\JobSeeker;
use App\Models\User;
use App\Notifications\ApplicationShortlistedNotification;
use App\Notifications\ApplicationRejectedNotification;
use App\Notifications\JobSeekerEmailVerificationNotification;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Tests\TestCase;

class EmailTemplatesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['mail.from.address' => 'notifications@example.com', 'mail.from.name' => 'LNU-HiRe Personnel']);
    }

    public function test_personal_or_invalid_reply_addresses_use_the_official_mailbox_for_both_statuses(): void
    {
        foreach ([ApplicationShortlistedNotification::class, ApplicationRejectedNotification::class] as $notificationClass) {
            foreach (['personnel@gmail.com', 'invalid-address', null] as $personnelEmail) {
                $mail = (new $notificationClass('Applicant', 'Instructor I', 'Personnel', $personnelEmail))->toMail(new JobSeeker());
                $this->assertSame('notifications@example.com', $mail->replyTo[0][0]);
                $this->assertSame('LNU-HiRe Personnel', $mail->replyTo[0][1]);
            }
        }
    }

    public function test_shortlisting_retains_the_position_and_personnel_reply_address(): void
    {
        $mail = (new ApplicationShortlistedNotification('Maria Cruz', 'Instructor I', 'Personnel', 'personnel@example.com'))->toMail(new JobSeeker());
        $this->assertSame('Dear Maria Cruz,', $mail->greeting);
        $this->assertContains('Position: Instructor I', $mail->introLines);
        $this->assertSame('personnel@example.com', $mail->replyTo[0][0]);
        $this->assertStringContainsString('Leyte Normal University', $mail->salutation);
    }

    public function test_job_seeker_verification_keeps_the_original_link(): void
    {
        $mail = (new JobSeekerEmailVerificationNotification('https://example.com/verify?token=abc'))->toMail(new JobSeeker(['full_name' => 'Maria Cruz']));
        $this->assertSame('Dear Maria Cruz,', $mail->greeting);
        $this->assertSame('https://example.com/verify?token=abc', $mail->actionUrl);
    }

    public function test_rejection_email_has_the_position_reply_address_and_a_formal_decision(): void
    {
        $mail = (new ApplicationRejectedNotification('Maria <Cruz>', 'Instructor I', 'Personnel', 'personnel@example.com'))->toMail(new JobSeeker());
        $this->assertSame('Dear Maria <Cruz>,', $mail->greeting);
        $this->assertSame('personnel@example.com', $mail->replyTo[0][0]);
        $html = view($mail->view['html'], $mail->data())->render();
        $text = view($mail->view['text'], $mail->data())->render();
        $this->assertStringContainsString('Maria &lt;Cruz&gt;', $html);
        $this->assertStringContainsString('Position: Instructor I', $text);
        $this->assertStringContainsString('will not proceed to the next stage', $text);
        $this->assertStringNotContainsString('localhost', $html.$text);
    }

    public function test_shortlisting_email_has_readable_html_and_plain_text_without_local_links(): void
    {
        config(['app.url' => 'http://localhost:8000']);
        $mail = (new ApplicationShortlistedNotification('Maria <Cruz>', 'Instructor I'))->toMail(new JobSeeker());
        $html = view($mail->view['html'], $mail->data())->render();
        $text = view($mail->view['text'], $mail->data())->render();
        $this->assertStringContainsString('Maria &lt;Cruz&gt;', $html);
        $this->assertStringContainsString('Dear Maria <Cruz>,', $text);
        $this->assertStringContainsString('Position: Instructor I', $text);
        $this->assertStringNotContainsString('localhost', $html.$text);
    }

    public function test_password_reset_links_and_expiry_match_each_account_type(): void
    {
        foreach ([User::class => 'users', Employer::class => 'employers', JobSeeker::class => 'job_seekers'] as $model => $broker) {
            config(['auth.passwords.'.$broker.'.expire' => 45]);
            $account = new $model(['email' => 'account@example.com']);
            $mail = (new ResetPassword('test-token'))->toMail($account);
            parse_str(parse_url($mail->actionUrl, PHP_URL_QUERY), $query);
            $this->assertSame($broker, $query['account_type']);
            $this->assertSame('account@example.com', $query['email']);
            $this->assertStringContainsString('test-token', $mail->actionUrl);
            $this->assertStringContainsString('45 minutes', implode(' ', $mail->outroLines));
        }
    }

    public function test_standard_verification_keeps_its_signed_link(): void
    {
        $user = new User(['name' => 'Personnel', 'email' => 'personnel@example.com']);
        $user->id = 123;
        $mail = (new VerifyEmail())->toMail($user);
        $this->assertSame('Dear Personnel,', $mail->greeting);
        $this->assertStringContainsString('/verify-email/123/', $mail->actionUrl);
        $this->assertStringContainsString('signature=', $mail->actionUrl);
    }
}
