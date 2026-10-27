<?php

namespace Tests\Feature;

use App\Models\Employer;
use App\Models\JobSeeker;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Tests\TestCase;

class PresenceTest extends TestCase
{
    use DatabaseTransactions;

    public function test_guests_cannot_report_or_read_presence(): void
    {
        $this->postJson('/api/auth/heartbeat', ['id' => 1])->assertUnauthorized();
        $this->getJson('/api/users/presence')->assertUnauthorized();
    }

    public function test_heartbeat_updates_only_the_signed_in_account_for_each_guard(): void
    {
        $this->travelTo(now()->startOfSecond());
        $accounts = [
            'web' => User::factory()->create(),
            'employer' => $this->personnel(),
            'job_seeker' => $this->seeker(),
        ];
        $other = $this->seeker();
        foreach ($accounts as $guard => $account) {
            foreach (['web', 'employer', 'job_seeker'] as $name) Auth::guard($name)->logout();
            $updatedAt = $account->updated_at->toISOString();
            $this->actingAs($account, $guard)->postJson('/api/auth/heartbeat', [
                'id' => $other->id, 'last_seen_at' => now()->addYear()->toISOString(),
            ])->assertOk();
            $this->assertSame(now()->format('Y-m-d H:i:s'), $account->fresh()->last_seen_at);
            $this->assertSame($updatedAt, $account->fresh()->updated_at->toISOString());
            $this->assertNull($other->fresh()->last_seen_at);
        }
    }

    public function test_login_cookie_authorizes_heartbeat_and_logout_stops_updates(): void
    {
        $account = $this->personnel();
        $response = $this->postJson('/api/staff/login', [
            'email' => $account->email, 'password' => 'test-password',
        ])->assertOk();
        $cookie = collect($response->headers->getCookies())
            ->first(fn ($cookie) => $cookie->getName() === config('session.cookie'));
        $this->assertNotNull($cookie);
        Auth::forgetGuards();
        $this->withUnencryptedCookie($cookie->getName(), $cookie->getValue())
            ->postJson('/api/auth/heartbeat')->assertOk();
        $lastSeen = $account->fresh()->last_seen_at;
        $this->assertNotNull($lastSeen);
        $this->postJson('/api/auth/logout')->assertOk();
        Auth::forgetGuards();
        $this->postJson('/api/auth/heartbeat')->assertUnauthorized();
        $this->assertSame($lastSeen, $account->fresh()->last_seen_at);
    }

    public function test_recent_activity_expires_and_account_types_do_not_collide(): void
    {
        $this->travelTo(now()->startOfSecond());
        $admin = User::factory()->create(['role' => 'admin']);
        $seeker = $this->seeker();
        $personnel = $this->personnel();
        $seeker->forceFill(['last_seen_at' => now()->subSeconds(119)])->save();
        $personnel->forceFill(['last_seen_at' => now()->subMinutes(5)])->save();
        $this->actingAs($admin, 'web')->getJson('/api/users/presence')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('accounts.jobseeker:'.$seeker->id.'.online', true)
            ->assertJsonPath('accounts.employer:'.$personnel->id.'.online', false)
            ->assertJsonPath('accounts.staff:'.$admin->id.'.online', false);
        $this->travel(1)->seconds();
        $this->getJson('/api/users/presence')->assertOk()
            ->assertJsonPath('accounts.jobseeker:'.$seeker->id.'.online', false);
        $this->assertNotNull($seeker->fresh()->last_seen_at);
    }

    public function test_job_seekers_cannot_read_other_users_activity(): void
    {
        $this->actingAs($this->seeker(), 'job_seeker')->getJson('/api/users/presence', [
            'X-Actor-Role' => 'admin',
        ])->assertForbidden();
    }

    public function test_personnel_need_users_page_access_to_read_activity(): void
    {
        $account = $this->personnel();
        $this->actingAs($account, 'employer')->getJson('/api/users/presence')->assertOk();
        $account->update(['page_access' => ['profile', 'ratings']]);
        $this->getJson('/api/users/presence')->assertForbidden();
        $account->update(['page_access' => ['users']]);
        $this->getJson('/api/users/presence')->assertOk();
    }

    public function test_default_board_accounts_cannot_read_activity(): void
    {
        $account = $this->personnel();
        $account->update(['position_type' => 'board']);
        $this->actingAs($account, 'employer')->getJson('/api/users/presence')->assertForbidden();
    }

    private function seeker(): JobSeeker
    {
        return JobSeeker::create([
            'full_name' => 'Presence Applicant', 'email' => Str::uuid().'@example.com',
            'password' => 'test-password',
        ]);
    }

    private function personnel(): Employer
    {
        return Employer::create([
            'company_name' => 'Presence Personnel', 'full_name' => 'Presence Personnel',
            'position_type' => 'personnel', 'email' => Str::uuid().'@example.com',
            'password' => 'test-password',
        ]);
    }
}
