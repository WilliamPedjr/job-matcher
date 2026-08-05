<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class ActivityLogController extends Controller
{
    public function index(): JsonResponse
    {
        try {
            $logs = ActivityLog::query()
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit(50)
                ->get()
                ->map(fn (ActivityLog $log) => $this->serialize($log));
        } catch (Throwable) {
            $logs = collect();
        }

        return response()->json($logs);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'max:255'],
            'subjectType' => ['nullable', 'string', 'max:120'],
            'subjectId' => ['nullable', 'integer'],
            'subjectName' => ['nullable', 'string', 'max:255'],
            'metadata' => ['nullable', 'array'],
        ]);

        $log = ActivityLog::record($data['event'], $data['description'], $request, [
            'subject_type' => $data['subjectType'] ?? null,
            'subject_id' => $data['subjectId'] ?? null,
            'subject_name' => $data['subjectName'] ?? null,
            'metadata' => $data['metadata'] ?? null,
        ]);

        if (!$log) {
            return response()->json([
                'message' => 'Activity was accepted, but activity logging is not ready yet.',
            ], 202);
        }

        return response()->json($this->serialize($log), 201);
    }

    private function serialize(ActivityLog $log): array
    {
        return [
            'id' => $log->id,
            'event' => $log->event,
            'description' => $log->description,
            'subject_type' => $log->subject_type,
            'subjectType' => $log->subject_type,
            'subject_id' => $log->subject_id,
            'subjectId' => $log->subject_id,
            'subject_name' => $log->subject_name,
            'subjectName' => $log->subject_name,
            'actor_name' => $log->actor_name,
            'actorName' => $log->actor_name,
            'actor_email' => $log->actor_email,
            'actorEmail' => $log->actor_email,
            'actor_role' => $log->actor_role,
            'actorRole' => $log->actor_role,
            'actorLabel' => $log->actor_label,
            'actorRoleLabel' => $log->actor_role_label,
            'metadata' => $log->metadata ?? [],
            'created_at' => $log->created_at?->toISOString(),
            'createdAt' => $log->created_at?->toISOString(),
        ];
    }
}
