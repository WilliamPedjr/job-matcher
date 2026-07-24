<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Job;
use App\Services\ResumeAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class MatchController extends Controller
{
    public function __construct(
        private readonly ResumeAnalysisService $resumeAnalysisService
    ) {
    }

    public function match(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cv' => ['required', 'file', 'max:10240'],
        ]);

        /** @var UploadedFile $file */
        $file = $data['cv'];
        $path = $file->storeAs('job-matcher/tmp', now()->format('YmdHis') . '-' . $file->hashName(), 'local');
        $fullPath = Storage::disk('local')->path($path);

        try {
            $resumeText = $this->resumeAnalysisService->analyzeFile(
                $fullPath,
                $file->getClientMimeType() ?: $file->getMimeType(),
                ''
            )['resume_text'];

            Job::closeExpiredActiveJobs();

            $jobs = Job::query()
                ->where('status', 'active')
                ->orderBy('id')
                ->get();

            if ($jobs->isEmpty()) {
                return response()->json(['success' => false, 'error' => 'No active jobs available for matching.'], 400);
            }

            $matches = $this->resumeAnalysisService->matchJobs($resumeText, $jobs);

            return response()->json([
                'success' => true,
                'previewText' => mb_substr($resumeText, 0, 1000),
                'matches' => $matches,
            ]);
        } finally {
            if (Storage::disk('local')->exists($path)) {
                Storage::disk('local')->delete($path);
            }
        }
    }
}
