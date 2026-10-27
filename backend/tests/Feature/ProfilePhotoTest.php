<?php

namespace Tests\Feature;

use App\Models\JobSeeker;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProfilePhotoTest extends TestCase
{
    use DatabaseTransactions;

    private JobSeeker $seeker;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seeker = JobSeeker::create([
            'full_name' => 'Photo Applicant', 'email' => 'photo-'.Str::uuid().'@example.com',
            'email_verified_at' => now(),
            'password' => 'test-password',
        ]);
    }

    public function test_only_the_signed_in_owner_can_upload_a_photo(): void
    {
        $this->postJson($this->url(), ['photo' => $this->picture()])->assertUnauthorized();
        $other = JobSeeker::create([
            'full_name' => 'Another Applicant', 'email' => 'photo-'.Str::uuid().'@example.com',
            'password' => 'test-password',
        ]);
        $this->actingAs($other, 'job_seeker')->postJson($this->url(), ['photo' => $this->picture()])->assertForbidden();
        $this->assertNull($this->seeker->fresh()->profile_photo_path);
        $this->assertSame([], Storage::disk('local')->allFiles('profile-photos'));
    }

    public function test_photo_is_saved_served_and_returned_in_profile_and_login(): void
    {
        $url = $this->actingAs($this->seeker, 'job_seeker')
            ->postJson($this->url(), ['photo' => $this->picture()])->assertOk()->json('profilePhotoUrl');
        Storage::disk('local')->assertExists($this->seeker->fresh()->profile_photo_path);
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->getJson('/api/job-seekers/'.$this->seeker->id)->assertOk()->assertJsonPath('jobSeeker.profilePhotoUrl', $url);
        $this->postJson('/api/auth/logout')->assertOk();
        $this->postJson('/api/job-seekers/login', [
            'identifier' => $this->seeker->email, 'password' => 'test-password',
        ])->assertOk()->assertJsonPath('profilePhotoUrl', $url);
    }

    public function test_replacement_changes_url_and_removes_old_photo(): void
    {
        $this->actingAs($this->seeker, 'job_seeker');
        $firstUrl = $this->postJson($this->url(), ['photo' => $this->picture()])->assertOk()->json('profilePhotoUrl');
        $oldPath = $this->seeker->fresh()->profile_photo_path;
        $newUrl = $this->postJson($this->url(), ['photo' => $this->picture()])->assertOk()->json('profilePhotoUrl');
        $this->assertNotSame($firstUrl, $newUrl);
        Storage::disk('local')->assertMissing($oldPath);
        Storage::disk('local')->assertExists($this->seeker->fresh()->profile_photo_path);
    }

    public function test_invalid_uploads_preserve_existing_photo(): void
    {
        $this->actingAs($this->seeker, 'job_seeker')->postJson($this->url(), ['photo' => $this->picture()])->assertOk();
        $path = $this->seeker->fresh()->profile_photo_path;
        $this->postJson($this->url())->assertUnprocessable()->assertJsonValidationErrors('photo');
        foreach ([
            UploadedFile::fake()->createWithContent('fake.png', 'This is not an image'),
            UploadedFile::fake()->createWithContent('photo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
            $this->picture()->size(5121),
        ] as $file) {
            $this->postJson($this->url(), ['photo' => $file])->assertUnprocessable()->assertJsonValidationErrors('photo');
        }
        $this->assertSame($path, $this->seeker->fresh()->profile_photo_path);
        Storage::disk('local')->assertExists($path);
        $this->assertCount(1, Storage::disk('local')->allFiles('profile-photos'));
    }

    public function test_profile_without_a_photo_uses_null_url(): void
    {
        $this->getJson('/api/job-seekers/'.$this->seeker->id)->assertOk()->assertJsonPath('jobSeeker.profilePhotoUrl', null);
        $this->get($this->url())->assertNotFound();
    }

    private function url(): string
    {
        return '/api/job-seekers/'.$this->seeker->id.'/photo';
    }

    private function picture(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('photo.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5VQAAAAASUVORK5CYII='
        ));
    }
}
