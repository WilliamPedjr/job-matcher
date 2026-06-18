<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GlobalSkillCatalog;
use App\Models\Job;
use App\Models\JobSkillCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SkillController extends Controller
{
    public function index(): JsonResponse
    {
        $skills = GlobalSkillCatalog::query()->orderBy('skill')->pluck('skill')->values();
        return response()->json(['skills' => $skills]);
    }

    public function catalog(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string'],
        ]);

        $title = Str::lower(trim($data['title']));
        $job = Job::query()
            ->whereRaw('LOWER(title) = ?', [$title])
            ->first();

        if (!$job) {
            return response()->json([
                'skills' => GlobalSkillCatalog::query()->orderBy('skill')->pluck('skill')->values(),
            ]);
        }

        $skills = JobSkillCatalog::query()
            ->where('job_id', $job->id)
            ->orderBy('skill')
            ->pluck('skill')
            ->values();

        return response()->json(['skills' => $skills]);
    }
}
