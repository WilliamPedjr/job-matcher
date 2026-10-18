<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EnsurePersonnelRatingAccess
{
    public function handle(Request $request, Closure $next, string $scope = 'export'): mixed
    {
        if ($scope === 'settings' && $request->input('event') !== 'rating.settings_updated') {
            return $next($request);
        }

        $staff = Auth::guard('web')->user();
        $employer = Auth::guard('employer')->user();

        if (!$staff && !$employer && !Auth::guard('job_seeker')->check()) {
            return response()->json(['message' => 'Please sign in to continue.'], 401);
        }

        $allowed = $staff
            ? !in_array(strtolower(trim((string) $staff->role)), ['board', 'jobseeker'], true)
            : ($employer && strtolower(trim((string) $employer->position_type)) !== 'board');

        if (!$allowed) {
            return response()->json([
                'message' => $scope === 'actions'
                    ? 'Only personnel accounts can manage schedules, examination scores, or cancel evaluations.'
                    : 'Only personnel accounts can edit rating criteria or export Excel files.',
            ], 403);
        }

        return $next($request);
    }
}
