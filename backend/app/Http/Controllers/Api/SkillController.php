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
    private const HIDDEN_MATCHING_MARKERS = [
        '__MATCH_ALL__', '__MATCH_MODERATE__', '__MATCH_NOT_QUALIFIED__', '__MATCH_55_PERCENT__',
    ];

    public function index(): JsonResponse
    {
        $skills = $this->publicSkills(GlobalSkillCatalog::query()->orderBy('skill')->pluck('skill'));
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
                'skills' => $this->publicSkills(GlobalSkillCatalog::query()->orderBy('skill')->pluck('skill')),
            ]);
        }

        $skills = JobSkillCatalog::query()
            ->where('job_id', $job->id)
            ->orderBy('skill')
            ->pluck('skill');

        return response()->json(['skills' => $this->publicSkills($skills)]);
    }

    private function publicSkills(iterable $skills): array
    {
        return collect($skills)->reject(function (string $skill): bool {
            return in_array(Str::upper(trim($skill)), self::HIDDEN_MATCHING_MARKERS, true)
                || preg_match('/^\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?\.?)\b.*\b(?:training|learning\s+and\s+development)\b/i', $skill) === 1;
        })->values()->all();
    }
}
