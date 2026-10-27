<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employer;
use App\Models\JobSeeker;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class PresenceController extends Controller
{
    public function heartbeat(): JsonResponse
    {
        // Identity comes only from the authenticated session, never request IDs.
        foreach (['web', 'employer', 'job_seeker'] as $guard) {
            if ($account = Auth::guard($guard)->user()) {
                DB::table($account->getTable())->where('id', $account->getKey())
                    ->update(['last_seen_at' => now()]);

                return response()->json(['success' => true]);
            }
        }

        return response()->json(['message' => 'Please sign in to continue.'], 401);
    }

    public function index(): JsonResponse
    {
        $staff = Auth::guard('web')->user();
        $personnel = Auth::guard('employer')->user();
        if (!$staff && !$personnel && !Auth::guard('job_seeker')->check()) {
            return response()->json(['message' => 'Please sign in to continue.'], 401);
        }

        $allowed = $staff && !in_array(strtolower((string) $staff->role), ['board', 'jobseeker'], true);
        if ($personnel) {
            $access = $personnel->page_access;
            $allowed = is_array($access) && count($access)
                ? in_array('users', $access, true)
                : strtolower((string) $personnel->position_type) !== 'board';
        }
        if (!$allowed) {
            return response()->json(['message' => 'You do not have access to user activity.'], 403);
        }

        $checkedAt = CarbonImmutable::now();
        $cutoff = $checkedAt->subMinutes(2);
        $accounts = [];
        $counts = ['jobseeker' => 0, 'employer' => 0, 'staff' => 0];
        foreach (['jobseeker' => JobSeeker::class, 'employer' => Employer::class, 'staff' => User::class] as $type => $model) {
            foreach ($model::query()->select(['id', 'last_seen_at'])->get() as $account) {
                $lastSeen = $account->last_seen_at
                    ? CarbonImmutable::parse($account->last_seen_at, config('app.timezone')) : null;
                $online = $lastSeen && $lastSeen->greaterThan($cutoff) && $lastSeen->lessThanOrEqualTo($checkedAt);
                $accounts[$type.':'.$account->id] = [
                    'lastSeenAt' => $lastSeen?->toISOString(),
                    'online' => (bool) $online,
                ];
                $counts[$type] += $online ? 1 : 0;
            }
        }

        return response()->json([
            'accounts' => $accounts,
            'onlineCount' => array_sum($counts),
            'counts' => $counts,
            'checkedAt' => $checkedAt->toISOString(),
        ])->header('Cache-Control', 'no-store');
    }
}
