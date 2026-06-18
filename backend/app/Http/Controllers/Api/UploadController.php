<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JobSeeker;
use App\Models\SupportingFile;
use App\Models\Upload;
use App\Services\ResumeAnalysisService;
use App\Services\TextExtractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    public function __construct(
        private readonly ResumeAnalysisService $resumeAnalysisService,
        private readonly TextExtractionService $textExtractionService
    ) {
    }

    public function index(): JsonResponse
    {
        $uploads = Upload::query()
            ->with('supportingFiles')
            ->orderByDesc('uploaded_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Upload $upload) => $this->serializeUpload($upload));

        return response()->json($uploads);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:6144'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'appliedJobTitle' => ['nullable', 'string', 'max:255'],
            'supportingTypes' => ['nullable'],
            'supportingFiles' => ['nullable'],
            'jobSeekerId' => ['nullable', 'integer'],
        ]);

        /** @var UploadedFile $file */
        $file = $data['file'];
        $stored = $this->storeFile($file, 'uploads/resumes');
        try {
            $analysis = $this->resumeAnalysisService->analyzeFile(
                Storage::disk('local')->path($stored['path']),
                $stored['mime_type'],
                (string) ($data['appliedJobTitle'] ?? ''),
                ''
            );
        } catch (\RuntimeException $exception) {
            $analysis = [
                'classification' => 'Not Qualified',
                'overall_score' => 0,
                'skills_match_score' => 0,
                'project_score' => 0,
                'education_match_score' => 0,
                'experience_match_score' => 0,
                'matched_job_title' => $data['appliedJobTitle'] ?? null,
                'matched_skills' => [],
                'missing_skills' => [],
                'education_text' => '',
                'experience_text' => '',
                'resume_text' => '',
            ];
        }

        $jobSeeker = null;
        if (!empty($data['jobSeekerId'])) {
            $jobSeeker = JobSeeker::find($data['jobSeekerId']);
        }
        if (!$jobSeeker) {
            $jobSeeker = JobSeeker::query()
                ->whereRaw('LOWER(email) = ?', [Str::lower(trim($data['email']))])
                ->first();
        }

        if (!$jobSeeker) {
            return response()->json([
                'message' => 'Unable to associate this upload with a job seeker. Please select or register the applicant first.',
            ], 422);
        }

        $upload = Upload::create([
            'job_seeker_id' => $jobSeeker?->id,
            'name' => $data['name'],
            'email' => Str::lower(trim($data['email'])),
            'phone' => $data['phone'] ?? null,
            'applied_job_title' => $data['appliedJobTitle'] ?? null,
            'original_name' => $stored['original_name'],
            'saved_name' => $stored['saved_name'],
            'file_path' => $stored['path'],
            'mime_type' => $stored['mime_type'],
            'classification' => $analysis['classification'],
            'match_score' => $analysis['overall_score'],
            'project_score' => $analysis['project_score'] ?? $analysis['skills_match_score'] ?? 0,
            'matched_job_title' => $analysis['matched_job_title'],
            'matched_skills' => $analysis['matched_skills'],
            'missing_skills' => $analysis['missing_skills'],
            'education_text' => $analysis['education_text'],
            'experience_text' => $analysis['experience_text'],
            'extracted_text' => $analysis['resume_text'],
            'experience_json' => array_values(array_filter(array_map(
                'trim',
                preg_split("/\n+/", (string) ($analysis['experience_text'] ?? '')) ?: []
            ))),
            'job_seeker_hidden' => false,
            'job_seeker_hidden_at' => null,
            'size_bytes' => $stored['size_bytes'],
            'uploaded_at' => now(),
        ]);

        $supportingFiles = $request->file('supportingFiles', []);
        if (!is_array($supportingFiles)) {
            $supportingFiles = [$supportingFiles];
        }
        $supportingTypes = $request->input('supportingTypes', []);
        if (!is_array($supportingTypes)) {
            $supportingTypes = [$supportingTypes];
        }

        foreach ($supportingFiles as $index => $supportingFile) {
            if (!$supportingFile instanceof UploadedFile) {
                continue;
            }

            $docType = $supportingTypes[$index] ?? 'others';
            $originalName = $supportingFile->getClientOriginalName();
            $sizeBytes = $supportingFile->getSize() ?: null;
            $duplicateExists = SupportingFile::query()
                ->where('job_seeker_id', $jobSeeker?->id)
                ->where('doc_type', $docType)
                ->where('original_name', $originalName)
                ->when($sizeBytes === null, fn ($query) => $query->whereNull('size_bytes'), fn ($query) => $query->where('size_bytes', $sizeBytes))
                ->exists();
            if ($duplicateExists) {
                continue;
            }

            $storedSupporting = $this->storeFile($supportingFile, 'uploads/supporting');
            try {
                $text = $this->textExtractionService->extract(Storage::disk('local')->path($storedSupporting['path']), $storedSupporting['mime_type']);
            } catch (\RuntimeException $exception) {
                $text = '';
            }
            SupportingFile::create([
                'job_seeker_id' => $jobSeeker?->id,
                'doc_type' => $docType,
                'original_name' => $storedSupporting['original_name'],
                'saved_name' => $storedSupporting['saved_name'],
                'file_path' => $storedSupporting['path'],
                'mime_type' => $storedSupporting['mime_type'],
                'size_bytes' => $storedSupporting['size_bytes'],
                'uploaded_at' => now(),
            ]);
        }

        return response()->json($this->serializeUpload($upload->fresh(['supportingFiles'])), 201);
    }

    public function show(int $id): JsonResponse
    {
        $upload = Upload::query()->with('supportingFiles')->findOrFail($id);
        return response()->json($this->serializeUpload($upload));
    }

    public function reanalyze(Request $request, int $id): JsonResponse
    {
        $upload = Upload::query()->with('supportingFiles')->findOrFail($id);
        $data = $request->validate([
            'file' => ['required', 'file', 'max:6144'],
        ]);

        /** @var UploadedFile $file */
        $file = $data['file'];
        if ($upload->file_path && Storage::disk('local')->exists($upload->file_path)) {
            Storage::disk('local')->delete($upload->file_path);
        }

        $stored = $this->storeFile($file, 'uploads/resumes');
        try {
            $analysis = $this->resumeAnalysisService->analyzeFile(
                Storage::disk('local')->path($stored['path']),
                $stored['mime_type'],
                (string) ($upload->applied_job_title ?? ''),
                ''
            );
        } catch (\RuntimeException $exception) {
            $analysis = [
                'classification' => 'Not Qualified',
                'overall_score' => 0,
                'skills_match_score' => 0,
                'project_score' => 0,
                'education_match_score' => 0,
                'experience_match_score' => 0,
                'matched_job_title' => $upload->applied_job_title ?? null,
                'matched_skills' => [],
                'missing_skills' => [],
                'education_text' => '',
                'experience_text' => '',
                'resume_text' => '',
            ];
        }

        $upload->fill([
            'original_name' => $stored['original_name'],
            'saved_name' => $stored['saved_name'],
            'file_path' => $stored['path'],
            'mime_type' => $stored['mime_type'],
            'classification' => $analysis['classification'],
            'match_score' => $analysis['overall_score'],
            'project_score' => $analysis['project_score'] ?? $analysis['skills_match_score'] ?? 0,
            'matched_job_title' => $analysis['matched_job_title'],
            'matched_skills' => $analysis['matched_skills'],
            'missing_skills' => $analysis['missing_skills'],
            'education_text' => $analysis['education_text'],
            'experience_text' => $analysis['experience_text'],
            'extracted_text' => $analysis['resume_text'],
            'experience_json' => array_values(array_filter(array_map(
                'trim',
                preg_split("/\n+/", (string) ($analysis['experience_text'] ?? '')) ?: []
            ))),
        ])->save();

        return response()->json($this->serializeUpload($upload->fresh(['supportingFiles'])));
    }

    public function download(int $id): mixed
    {
        $upload = Upload::findOrFail($id);
        abort_if(!$upload->file_path || !Storage::disk('local')->exists($upload->file_path), 404, 'Upload not found.');
        return Storage::disk('local')->download($upload->file_path, $upload->original_name ?: basename($upload->file_path));
    }

    public function supporting(int $id): JsonResponse
    {
        $upload = Upload::query()->with('supportingFiles')->findOrFail($id);
        return response()->json([
            'files' => $upload->supportingFiles->map(fn (SupportingFile $file) => $this->serializeSupportingFile($file, $upload->id))->values(),
        ]);
    }

    public function supportingDownload(int $id, int $supportId): mixed
    {
        $upload = Upload::findOrFail($id);
        $file = SupportingFile::query()
            ->where('job_seeker_id', $upload->job_seeker_id)
            ->where('id', $supportId)
            ->firstOrFail();
        abort_if(!$file->file_path || !Storage::disk('local')->exists($file->file_path), 404, 'Supporting file not found.');
        return Storage::disk('local')->download($file->file_path, $file->original_name ?: basename($file->file_path));
    }

    public function destroy(int $id): JsonResponse
    {
        $upload = Upload::findOrFail($id);
        if ($upload->file_path && Storage::disk('local')->exists($upload->file_path)) {
            Storage::disk('local')->delete($upload->file_path);
        }
        $upload->delete();

        return response()->json(['message' => 'Upload deleted successfully.']);
    }

    public function hide(int $id): JsonResponse
    {
        $upload = Upload::findOrFail($id);
        $upload->job_seeker_hidden = true;
        $upload->job_seeker_hidden_at = now();
        $upload->save();

        return response()->json($this->serializeUpload($upload));
    }

    private function storeFile(UploadedFile $file, string $directory): array
    {
        $safeName = now()->format('YmdHis') . '-' . Str::random(12) . '-' . Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
        $extension = $file->getClientOriginalExtension() ?: $file->extension() ?: 'bin';
        $savedName = $safeName . '.' . $extension;
        $path = $file->storeAs($directory, $savedName, 'local');

        return [
            'path' => $path,
            'saved_name' => $savedName,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType() ?: $file->getMimeType(),
            'size_bytes' => $file->getSize() ?: null,
        ];
    }

    private function serializeUpload(Upload $upload): array
    {
        $uploadedAt = $upload->uploaded_at instanceof \DateTimeInterface
            ? $upload->uploaded_at->toISOString()
            : ($upload->uploaded_at ? (string) $upload->uploaded_at : null);

        return [
            'id' => $upload->id,
            'job_seeker_id' => $upload->job_seeker_id,
            'jobSeekerId' => $upload->job_seeker_id,
            'name' => $upload->name,
            'email' => $upload->email,
            'phone' => $upload->phone,
            'applied_job_title' => $upload->applied_job_title,
            'appliedJobTitle' => $upload->applied_job_title,
            'original_name' => $upload->original_name,
            'saved_name' => $upload->saved_name,
            'mimeType' => $upload->mime_type,
            'mime_type' => $upload->mime_type,
            'classification' => $upload->classification,
            'match_score' => $upload->match_score,
            'overall_score' => $upload->match_score,
            'overallScore' => $upload->match_score,
            'project_score' => $upload->project_score,
            'skills_match_score' => $upload->project_score,
            'education_match_score' => null,
            'experience_match_score' => null,
            'matched_job_title' => $upload->matched_job_title,
            'matchedSkills' => $upload->matched_skills ?? [],
            'matched_skills' => $upload->matched_skills ?? [],
            'missingSkills' => $upload->missing_skills ?? [],
            'missing_skills' => $upload->missing_skills ?? [],
            'education_text' => $upload->education_text,
            'education_json' => array_values(array_filter(array_map(
                'trim',
                preg_split("/\n+/", (string) ($upload->education_text ?? '')) ?: []
            ))),
            'experience_text' => $upload->experience_text,
            'extracted_text' => $upload->extracted_text,
            'experience_json' => $upload->experience_json,
            'job_seeker_hidden' => $upload->job_seeker_hidden,
            'job_seeker_hidden_at' => $upload->job_seeker_hidden_at,
            'hidden' => $upload->job_seeker_hidden,
            'uploaded_at' => $uploadedAt,
            'updatedAt' => $uploadedAt,
            'updated_at' => $uploadedAt,
            'size_bytes' => $upload->size_bytes,
            'download_url' => url("/api/uploads/{$upload->id}/download"),
            'supportingFiles' => $upload->relationLoaded('supportingFiles')
                ? $upload->supportingFiles->map(fn (SupportingFile $file) => $this->serializeSupportingFile($file, $upload->id))->values()
                : [],
        ];
    }

    private function serializeSupportingFile(SupportingFile $file, ?int $uploadId = null): array
    {
        $routeUploadId = $uploadId ?? $file->job_seeker_id;
        return [
            'id' => $file->id,
            'job_seeker_id' => $file->job_seeker_id,
            'doc_type' => $file->doc_type,
            'type' => $file->doc_type,
            'original_name' => $file->original_name,
            'originalName' => $file->original_name,
            'saved_name' => $file->saved_name,
            'savedName' => $file->saved_name,
            'mime_type' => $file->mime_type,
            'mimeType' => $file->mime_type,
            'size_bytes' => $file->size_bytes,
            'uploaded_at' => $file->uploaded_at,
            'download_url' => url("/api/uploads/{$routeUploadId}/supporting/{$file->id}/download"),
        ];
    }
}
