<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Archive;
use App\Models\Employer;
use App\Models\JobSeeker;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class PersonnelRestoreTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
    }

    public function test_deleted_personnel_can_be_restored_with_original_credentials_and_access(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $original = Employer::create($this->accountData());
        $hash = $original->password;
        $this->deleteJson('/api/employers/'.$original->id)->assertOk();
        $archive = Archive::where('record_type', 'personnel')->where('record_id', $original->id)->latest('id')->firstOrFail();
        $row = collect($this->getJson('/api/archives')->assertOk()->json())->firstWhere('id', $archive->id);
        $this->assertFalse($row['requires_password']);
        $this->assertArrayNotHasKey('password', $row['data']);
        $this->assertArrayNotHasKey('password', ActivityLog::where('event', 'personnel.deleted')->latest('id')->first()->metadata['record']);
        $result = $this->postJson($this->url($archive))->assertOk();
        $restored = Employer::findOrFail($result->json('personnel.id'));
        foreach (['email', 'username', 'id_number', 'phone', 'full_name', 'company_name', 'position_type', 'page_access'] as $field) {
            $this->assertSame($original->$field, $restored->$field);
        }
        $this->assertSame($hash, $restored->password);
        $this->assertDatabaseMissing('archives', ['id' => $archive->id]);
        $this->postJson($this->url($archive))->assertNotFound();
        $this->postJson('/api/employers/login', ['identifier' => $restored->email, 'password' => 'test-password'])->assertOk();
        $this->assertDatabaseHas('activity_logs', ['event' => 'personnel.restored', 'subject_id' => $restored->id]);
    }

    public function test_legacy_archive_requires_a_new_password_then_can_log_in(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $archive = $this->archivedAccount();
        $this->postJson($this->url($archive))->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson($this->url($archive), ['password' => 'short'])->assertUnprocessable();
        $this->assertDatabaseHas('archives', ['id' => $archive->id]);
        $this->postJson($this->url($archive), ['password' => 'restored-password'])->assertOk();
        $restored = Employer::where('email', $archive->data['email'])->firstOrFail();
        $this->assertTrue(Hash::check('restored-password', $restored->password));
        $this->postJson('/api/employers/login', ['identifier' => $restored->email, 'password' => 'restored-password'])->assertOk();
    }

    public function test_conflicting_identifiers_leave_the_archive_intact(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $existing = Employer::create($this->accountData());
        foreach (['email', 'username', 'id_number'] as $field) {
            $archive = $this->archivedAccount([$field => $existing->$field]);
            $this->postJson($this->url($archive), ['password' => 'restored-password'])->assertUnprocessable();
            $this->assertDatabaseHas('archives', ['id' => $archive->id]);
        }
        $this->assertSame($existing->password, $existing->fresh()->password);
    }

    public function test_restoration_requires_authenticated_account_management_access(): void
    {
        $archive = $this->archivedAccount();
        $headers = ['X-Actor-Role' => 'admin'];
        $this->postJson($this->url($archive), ['password' => 'restored-password'], $headers)->assertUnauthorized();
        $board = Employer::create($this->accountData(['position_type' => 'board']));
        $this->actingAs($board, 'employer')->postJson($this->url($archive), [], $headers)->assertForbidden();
        Auth::guard('employer')->logout();
        $applicant = JobSeeker::create(['full_name' => 'Applicant', 'email' => Str::uuid().'@example.com', 'password' => 'test-password']);
        $this->actingAs($applicant, 'job_seeker')->postJson($this->url($archive), [], $headers)->assertForbidden();
        Auth::guard('job_seeker')->logout();
        $restricted = Employer::create($this->accountData(['page_access' => ['archive']]));
        $this->actingAs($restricted, 'employer')->postJson($this->url($archive), [], $headers)->assertForbidden();
        $this->assertDatabaseHas('archives', ['id' => $archive->id]);
    }

    public function test_personnel_with_users_and_archive_access_can_restore_an_account(): void
    {
        $manager = Employer::create($this->accountData(['page_access' => ['users', 'archive']]));
        $archive = $this->archivedAccount();
        $this->actingAs($manager, 'employer')->postJson($this->url($archive), ['password' => 'restored-password'])->assertOk();
    }

    public function test_non_personnel_records_and_missing_email_are_rejected(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        $archive = $this->archivedAccount();
        $archive->update(['record_type' => 'job']);
        $this->postJson($this->url($archive))->assertUnprocessable();
        $archive->update(['record_type' => 'personnel', 'subtitle' => null, 'data' => ['full_name' => 'Missing Email']]);
        $this->postJson($this->url($archive))->assertUnprocessable();
        $this->assertDatabaseHas('archives', ['id' => $archive->id]);
    }

    private function accountData(array $changes = []): array
    {
        $unique = (string) Str::uuid();
        return array_merge([
            'company_name' => 'HR Personnel', 'full_name' => 'Test Personnel', 'email' => $unique.'@example.com',
            'username' => $unique, 'id_number' => 'P-'.$unique, 'phone' => '+639171234567',
            'position_type' => 'personnel', 'page_access' => ['jobs', 'profile'], 'password' => 'test-password',
        ], $changes);
    }

    private function archivedAccount(array $changes = []): Archive
    {
        $data = $this->accountData($changes);
        unset($data['password']);
        return Archive::create(['record_type' => 'personnel', 'record_id' => 987654321, 'title' => $data['company_name'],
            'subtitle' => $data['email'], 'data' => $data, 'deleted_at' => now()]);
    }

    private function url(Archive $archive): string
    {
        return '/api/archives/'.$archive->id.'/restore-personnel';
    }
}
