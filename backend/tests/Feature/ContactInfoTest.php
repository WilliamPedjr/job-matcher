<?php

namespace Tests\Feature;

use App\Models\JobSeeker;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class ContactInfoTest extends TestCase
{
    use DatabaseTransactions;

    private function seeker(array $attributes = []): JobSeeker
    {
        return JobSeeker::create(array_merge([
            'full_name' => 'Contact Applicant', 'email' => 'contact-'.Str::uuid().'@example.com',
            'password' => 'test-password', 'email_verified_at' => now(),
        ], $attributes));
    }

    public function test_contact_details_persist_and_are_returned_after_login(): void
    {
        $seeker = $this->seeker(['address' => 'Original address', 'manual_skills' => ['Management']]);
        $url = '/api/job-seekers/'.$seeker->id;
        $email = 'updated-'.Str::uuid().'@example.com';
        $this->putJson($url, [
            'email' => $email, 'phone' => '+639171234567', 'linkedInUrl' => 'https://www.linkedin.com/in/applicant',
        ])->assertOk()->assertJsonPath('linkedInUrl', 'https://www.linkedin.com/in/applicant')
            ->assertJsonPath('email', $email)->assertJsonPath('phone', '+639171234567')
            ->assertJsonPath('fullName', 'Contact Applicant')->assertJsonPath('address', 'Original address')
            ->assertJsonPath('manual_skills', ['Management']);
        $this->getJson($url)->assertOk()->assertJsonPath('jobSeeker.linkedInUrl', 'https://www.linkedin.com/in/applicant');
        $this->postJson('/api/job-seekers/login', ['identifier' => $email, 'password' => 'test-password'])
            ->assertOk()->assertJsonPath('linkedInUrl', 'https://www.linkedin.com/in/applicant')
            ->assertJsonPath('phone', '+639171234567');
    }

    public function test_optional_contact_fields_can_be_cleared_and_unrelated_edits_preserve_them(): void
    {
        $seeker = $this->seeker(['linked_in_url' => 'https://linkedin.com/in/applicant', 'phone' => '+639171234567']);
        $url = '/api/job-seekers/'.$seeker->id;
        $this->putJson($url, ['email' => $seeker->email])->assertOk()
            ->assertJsonPath('linkedInUrl', 'https://linkedin.com/in/applicant');
        $this->putJson($url, ['linkedInUrl' => null, 'phone' => ''])->assertOk()
            ->assertJsonPath('linkedInUrl', null)->assertJsonPath('phone', null);
        $this->assertSame($seeker->email, $seeker->fresh()->email);
    }

    public function test_invalid_urls_and_conflicting_emails_are_rejected_without_changing_contacts(): void
    {
        $seeker = $this->seeker(['linked_in_url' => 'https://linkedin.com/in/applicant']);
        $other = $this->seeker();
        $url = '/api/job-seekers/'.$seeker->id;
        foreach (['javascript:alert(1)', 'ftp://example.com/profile', 'not-a-link'] as $link) {
            $this->putJson($url, ['linkedInUrl' => $link])->assertUnprocessable()->assertJsonValidationErrors('linkedInUrl');
        }
        $this->putJson($url, ['email' => $other->email])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->putJson($url, ['email' => 'invalid'])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertSame($seeker->email, $seeker->fresh()->email);
        $this->assertSame('https://linkedin.com/in/applicant', $seeker->fresh()->linked_in_url);
    }
}
