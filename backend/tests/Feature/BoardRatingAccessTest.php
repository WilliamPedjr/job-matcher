<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Employer;
use App\Models\Upload;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Tests\TestCase;

class BoardRatingAccessTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
    }

    public static function exportUrls(): array
    {
        return [
            'applications' => ['/api/uploads/summary/export'],
            'overall ratings' => ['/api/uploads/ratings-summary/export'],
            'interview' => ['/api/uploads/999999999/rating-summary/export'],
            'demonstration' => ['/api/uploads/999999999/demonstration-summary/export'],
        ];
    }

    /** @dataProvider exportUrls */
    public function test_board_accounts_cannot_export_even_with_spoofed_personnel_headers(string $url): void
    {
        $board = $this->newEmployer('board');
        $this->actingAs($board, 'employer')->getJson($url, [
            'X-Actor-Role' => 'admin',
            'X-Actor-Email' => 'hr@example.com',
        ])->assertForbidden()->assertJsonPath('message', 'Only personnel accounts can edit rating criteria or export Excel files.');
    }

    /** @dataProvider exportUrls */
    public function test_exports_require_a_signed_in_staff_account(string $url): void
    {
        $this->getJson($url, ['X-Actor-Role' => 'admin'])->assertUnauthorized();
    }

    public function test_board_accounts_cannot_submit_rating_settings_changes(): void
    {
        $count = ActivityLog::where('event', 'rating.settings_updated')->count();
        $this->actingAs($this->newEmployer('board'), 'employer')
            ->postJson('/api/activity-logs', $this->settingsPayload())
            ->assertForbidden();
        $this->assertSame($count, ActivityLog::where('event', 'rating.settings_updated')->count());
    }

    public function test_personnel_can_export_and_save_rating_settings(): void
    {
        $this->actingAs($this->newEmployer('personnel'), 'employer');
        $this->get('/api/uploads/summary/export')->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.ms-excel; charset=UTF-8');
        $this->get('/api/uploads/ratings-summary/export')->assertOk();
        $this->postJson('/api/activity-logs', $this->settingsPayload())->assertCreated();
    }

    public function test_personnel_login_cookie_authorizes_a_fresh_protected_request(): void
    {
        $personnel = $this->newEmployer('personnel');
        $response = $this->postJson('/api/staff/login', [
            'email' => $personnel->email, 'password' => 'test-password',
        ])->assertOk();
        $cookie = collect($response->headers->getCookies())
            ->first(fn ($cookie) => $cookie->getName() === config('session.cookie'));
        $this->assertNotNull($cookie);
        Auth::forgetGuards();
        $this->withUnencryptedCookie($cookie->getName(), $cookie->getValue())
            ->getJson('/api/uploads/ratings-summary/export')->assertOk();
    }

    public function test_admin_can_export_and_save_rating_settings(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin, 'web');
        $this->get('/api/uploads/ratings-summary/export')->assertOk();
        $this->postJson('/api/activity-logs', $this->settingsPayload())->assertCreated();
    }

    public function test_board_accounts_can_still_record_other_rating_activity(): void
    {
        $this->actingAs($this->newEmployer('board'), 'employer')
            ->postJson('/api/activity-logs', [
                'event' => 'rating.saved', 'description' => 'Saved an interview rating.',
            ])->assertCreated();
    }

    public static function personnelActions(): array
    {
        return [
            'interview schedule' => ['interview-date', ['interviewDate' => '2030-10-23', 'interviewPlace' => 'Room 2', 'interviewTime' => '11:00']],
            'demonstration schedule' => ['demonstration-date', ['demonstrationDate' => '2030-10-24', 'demonstrationPlace' => 'Room 3', 'demonstrationTime' => '10:00']],
            'examination score' => ['examination', ['examinationScore' => 95]],
            'cancel or delete evaluation' => ['evaluation/cancel', []],
        ];
    }

    /** @dataProvider personnelActions */
    public function test_board_accounts_cannot_run_other_action_menu_operations(string $action, array $payload): void
    {
        $upload = $this->newApplication();
        $before = $upload->fresh()->getAttributes();
        $logCount = ActivityLog::count();

        $this->actingAs($this->newEmployer('board'), 'employer')
            ->putJson('/api/uploads/'.$upload->id.'/'.$action, $payload, ['X-Actor-Role' => 'admin'])
            ->assertForbidden();

        $this->assertSame($before, $upload->fresh()->getAttributes());
        $this->assertSame($logCount, ActivityLog::count());
    }

    /** @dataProvider personnelActions */
    public function test_personnel_retain_the_other_action_menu_operations(string $action, array $payload): void
    {
        $upload = $this->newApplication();
        $this->actingAs($this->newEmployer('personnel'), 'employer')
            ->putJson('/api/uploads/'.$upload->id.'/'.$action, $payload)->assertOk();
    }

    /** @dataProvider personnelActions */
    public function test_signed_out_requests_cannot_bypass_action_permissions(string $action, array $payload): void
    {
        $this->putJson('/api/uploads/999999999/'.$action, $payload, ['X-Actor-Role' => 'admin'])
            ->assertUnauthorized();
    }

    public function test_board_accounts_can_view_applications_and_submit_their_ratings(): void
    {
        $upload = $this->newApplication();
        $board = $this->newEmployer('board');
        $this->actingAs($board, 'employer');
        $this->getJson('/api/uploads/'.$upload->id)->assertOk()->assertJsonPath('id', $upload->id);
        $this->postJson('/api/uploads/'.$upload->id.'/ratings', [
            'raterName' => 'Board Member', 'raterEmail' => $board->email,
            'formType' => 'interview', 'scores' => ['Knowledge' => 5, 'Communication' => 4],
        ])->assertOk();
        $this->assertDatabaseHas('application_ratings', [
            'upload_id' => $upload->id, 'rater_email' => $board->email,
        ]);
    }

    private function newApplication(): Upload
    {
        return Upload::create([
            'name' => 'Action Permissions Applicant', 'email' => 'applicant@example.com',
            'applied_job_title' => 'Administrative Officer', 'evaluation_status' => 'interview',
            'original_name' => 'pds.txt', 'file_path' => 'permissions/pds.txt',
            'mime_type' => 'text/plain', 'uploaded_at' => now(),
            'interview_date' => '2030-10-22', 'interview_place' => 'Room 1',
        ]);
    }

    private function newEmployer(string $position): Employer
    {
        return Employer::create([
            'company_name' => 'Rating Access Test',
            'email' => 'ratings-access-'.Str::uuid().'@example.com',
            'password' => 'test-password',
            'position_type' => $position,
            'page_access' => ['ratings', 'profile', 'help'],
        ]);
    }

    private function settingsPayload(): array
    {
        return [
            'event' => 'rating.settings_updated',
            'description' => 'Edited rating form settings.',
            'subjectType' => 'rating_settings',
            'metadata' => ['after' => ['criteria' => ['Changed criterion']]],
        ];
    }
}
