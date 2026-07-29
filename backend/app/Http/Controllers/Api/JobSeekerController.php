<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Archive;
use App\Models\Education;
use App\Models\Experience;
use App\Models\JobSeeker;
use App\Models\SupportingFile;
use App\Models\Upload;
use App\Services\ResumeAnalysisService;
use App\Services\TextExtractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class JobSeekerController extends Controller
{
    public function __construct(
        private readonly ResumeAnalysisService $resumeAnalysisService,
        private readonly TextExtractionService $textExtractionService
    ) {
    }

    public function indexAll(): JsonResponse
    {
        $jobSeekers = JobSeeker::query()
            ->with(['educations', 'experiences'])
            ->orderBy('id')
            ->get()
            ->map(fn (JobSeeker $jobSeeker) => $this->serializeJobSeeker($jobSeeker));

        return response()->json($jobSeekers);
    }

    public function show(int $id): JsonResponse
    {
        $jobSeeker = JobSeeker::query()
            ->with(['educations', 'experiences'])
            ->findOrFail($id);

        return response()->json([
            'jobSeeker' => $this->serializeJobSeeker($jobSeeker, true),
            'resume' => $this->serializeResume($this->getResumeUpload($jobSeeker->id)),
            'supportingFiles' => $this->serializeSupportingFiles($jobSeeker->supportingFiles()->orderByDesc('id')->get()),
            'educations' => $jobSeeker->educations->map(fn (Education $education) => $this->serializeEducation($education))->values(),
            'experiences' => $jobSeeker->experiences->map(fn (Experience $experience) => $this->serializeExperience($experience))->values(),
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $jobSeeker = JobSeeker::findOrFail($id);
        $data = $request->validate([
            'full_name' => ['nullable', 'string', 'max:255'],
            'fullName' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'username' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'status' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'about_text' => ['nullable', 'string'],
            'aboutText' => ['nullable', 'string'],
            'password' => ['nullable', 'string', 'min:8', 'max:72'],
        ]);

        if (array_key_exists('full_name', $data) || array_key_exists('fullName', $data)) {
            $fullName = $data['full_name'] ?? $data['fullName'];
            if ($fullName !== null && trim((string) $fullName) !== '') {
                $jobSeeker->full_name = trim((string) $fullName);
            }
        }
        if (array_key_exists('email', $data)) {
            $email = $data['email'];
            if ($email !== null && trim((string) $email) !== '') {
                $jobSeeker->email = Str::lower(trim((string) $email));
            }
        }
        if (array_key_exists('username', $data)) {
            $jobSeeker->username = $data['username'];
        }
        if (array_key_exists('phone', $data)) {
            $jobSeeker->phone = $data['phone'];
        }
        if (array_key_exists('status', $data)) {
            $jobSeeker->status = $data['status'];
        }
        if (array_key_exists('address', $data)) {
            $jobSeeker->address = $data['address'];
        }
        if (array_key_exists('about_text', $data) || array_key_exists('aboutText', $data)) {
            $jobSeeker->about_text = $data['about_text'] ?? $data['aboutText'];
        }
        if (!empty($data['password'])) {
            $jobSeeker->password = Hash::make($data['password']);
        }

        $jobSeeker->save();

        return response()->json($this->serializeJobSeeker($jobSeeker));
    }

    public function updateAdmin(Request $request, int $id): JsonResponse
    {
        return $this->update($request, $id);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $jobSeeker = JobSeeker::query()
            ->with(['educations', 'experiences'])
            ->findOrFail($id);

        Archive::create([
            'record_type' => 'job_seeker',
            'record_id' => $jobSeeker->id,
            'title' => $jobSeeker->full_name,
            'subtitle' => $jobSeeker->email,
            'data' => $this->serializeJobSeeker($jobSeeker, true),
            ...Archive::actorFromRequest($request),
            'deleted_at' => now(),
        ]);

        $jobSeeker->delete();

        return response()->json(['message' => 'Job seeker deleted successfully.']);
    }

    public function resume(Request $request, int $id): JsonResponse
    {
        $resume = $this->getResumeUpload($id);
        return response()->json(['resume' => $this->serializeResume($resume)]);
    }

    public function storeResume(Request $request, int $id): JsonResponse
    {
        $jobSeeker = JobSeeker::findOrFail($id);
        $data = $request->validate([
            'file' => ['required', 'file', 'max:6144'],
        ]);

        /** @var UploadedFile $file */
        $file = $data['file'];
        $stored = $this->storeFile($file, 'job-seeker/resumes/' . $jobSeeker->id);
        try {
            $analysis = $this->resumeAnalysisService->analyzeFile(
                Storage::disk('local')->path($stored['path']),
                $stored['mime_type'],
                '',
                $this->extractExistingSupportingText($jobSeeker->id)
            );
        } catch (\RuntimeException $exception) {
            $analysis = [
                'classification' => 'Not Qualified',
                'overall_score' => 0,
                'skills_match_score' => 0,
                'project_score' => 0,
                'education_match_score' => 0,
                'experience_match_score' => 0,
                'matched_job_title' => null,
                'matched_skills' => [],
                'missing_skills' => [],
                'education_text' => '',
                'experience_text' => '',
                'resume_text' => '',
                'summary_text' => '',
                'resume_summary' => [],
            ];
        }

        $existing = Upload::query()
            ->where('job_seeker_id', $jobSeeker->id)
            ->where(function ($query) {
                $query->whereNull('applied_job_title')
                    ->orWhere('applied_job_title', '');
            })
            ->orderByDesc('uploaded_at')
            ->orderByDesc('id')
            ->first();

        if ($existing && $existing->file_path && Storage::disk('local')->exists($existing->file_path)) {
            Storage::disk('local')->delete($existing->file_path);
        }

        $resume = $existing ?: new Upload(['job_seeker_id' => $jobSeeker->id]);
        $educationLines = array_values(array_filter(array_map(
            'trim',
            preg_split("/\n+/", (string) ($analysis['education_text'] ?? '')) ?: []
        )));
        $experienceLines = array_values(array_filter(array_map(
            'trim',
            preg_split("/\n+/", (string) ($analysis['experience_text'] ?? '')) ?: []
        )));
        $resume->fill([
            'name' => $jobSeeker->full_name,
            'email' => $jobSeeker->email,
            'phone' => $jobSeeker->phone,
            'applied_job_title' => null,
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
            'education_json' => $educationLines,
            'experience_json' => $experienceLines,
            'summary_text' => $analysis['summary_text'] ?? '',
            'resume_summary' => $analysis['resume_summary'] ?? [],
            'job_seeker_hidden' => false,
            'job_seeker_hidden_at' => null,
            'size_bytes' => $stored['size_bytes'],
            'uploaded_at' => now(),
        ]);
        $resume->job_seeker_id = $jobSeeker->id;
        $resume->save();

        return response()->json([
            'message' => 'Resume uploaded successfully.',
            'resume' => $this->serializeResume($resume),
        ], 201);
    }

    public function downloadResume(int $id): mixed
    {
        $resume = $this->getResumeUpload($id);
        abort_if(!$resume || !$resume->file_path || !Storage::disk('local')->exists($resume->file_path), 404, 'Resume not found.');

        return Storage::disk('local')->download($resume->file_path, $resume->original_name ?: basename($resume->file_path));
    }

    public function deleteResume(Request $request, int $id): JsonResponse
    {
        $resume = $this->getResumeUpload($id);
        if ($resume) {
            Archive::create([
                'record_type' => 'application',
                'record_id' => $resume->id,
                'title' => $resume->name ?: $resume->original_name,
                'subtitle' => $resume->applied_job_title ?: $resume->matched_job_title,
                'data' => $this->serializeResume($resume),
                ...Archive::actorFromRequest($request),
                'deleted_at' => now(),
            ]);

            if ($resume->file_path && Storage::disk('local')->exists($resume->file_path)) {
                Storage::disk('local')->delete($resume->file_path);
            }
            $resume->delete();
        }

        return response()->json(['message' => 'Resume deleted successfully.']);
    }

    public function resumeMatch(Request $request, int $id): JsonResponse
    {
        $jobSeeker = JobSeeker::findOrFail($id);
        $data = $request->validate([
            'jobTitle' => ['nullable', 'string'],
        ]);

        $resume = $this->getResumeUpload($jobSeeker->id);
        if (!$resume || !$resume->file_path || !Storage::disk('local')->exists($resume->file_path)) {
            return response()->json(['message' => 'Resume not found.'], 404);
        }

        $jobTitle = (string) ($data['jobTitle'] ?? '');
        $analysis = $this->resumeAnalysisService->analyzeFile(
            Storage::disk('local')->path($resume->file_path),
            $resume->mime_type,
            $jobTitle,
            $this->extractExistingSupportingText($jobSeeker->id)
        );

        return response()->json([
            'success' => true,
            'matchScore' => $analysis['overall_score'],
            'minimumScore' => 50,
            'previewText' => $analysis['preview_text'],
            'analysis' => $analysis,
        ]);
    }

    public function resumeMatchBatch(Request $request, int $id): JsonResponse
    {
        $jobSeeker = JobSeeker::findOrFail($id);
        $data = $request->validate([
            'jobTitles' => ['required', 'array'],
            'jobTitles.*' => ['nullable', 'string'],
        ]);

        $resume = $this->getResumeUpload($jobSeeker->id);
        if (!$resume || !$resume->file_path || !Storage::disk('local')->exists($resume->file_path)) {
            return response()->json(['message' => 'Resume not found.'], 404);
        }

        $matches = [];
        foreach ($data['jobTitles'] as $jobTitle) {
            $title = trim((string) $jobTitle);
            if ($title === '') {
                continue;
            }

            $analysis = $this->resumeAnalysisService->analyzeFile(
                    Storage::disk('local')->path($resume->file_path),
                    $resume->mime_type,
                    $title,
                    $this->extractExistingSupportingText($jobSeeker->id)
                );

            $matches[] = [
                'key' => Str::lower($title),
                'score' => $analysis['overall_score'],
                'minimumScore' => 50,
                'qualifies' => $analysis['overall_score'] >= 50,
            ];
        }

        return response()->json([
            'success' => true,
            'matches' => $matches,
        ]);
    }

    public function supportingFiles(int $id): JsonResponse
    {
        $files = SupportingFile::query()
            ->where('job_seeker_id', $id)
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'files' => $this->serializeSupportingFiles($files),
        ]);
    }

    public function storeSupportingFiles(Request $request, int $id): JsonResponse
    {
        $jobSeeker = JobSeeker::findOrFail($id);
        $request->validate([
            'supportingFiles' => ['required'],
        ]);

        $files = $request->file('supportingFiles', []);
        if (!is_array($files)) {
            $files = [$files];
        }

        $types = $request->input('supportingTypes', []);
        if (!is_array($types)) {
            $types = [$types];
        }

        $created = [];
        foreach ($files as $index => $file) {
            if (!$file instanceof UploadedFile) {
                continue;
            }

            $docType = $types[$index] ?? 'others';
            $originalName = $file->getClientOriginalName();
            $sizeBytes = $file->getSize() ?: null;
            $duplicateExists = SupportingFile::query()
                ->where('job_seeker_id', $jobSeeker->id)
                ->where('doc_type', $docType)
                ->where('original_name', $originalName)
                ->when($sizeBytes === null, fn ($query) => $query->whereNull('size_bytes'), fn ($query) => $query->where('size_bytes', $sizeBytes))
                ->exists();
            if ($duplicateExists) {
                continue;
            }

            $stored = $this->storeFile($file, 'job-seeker/supporting/' . $jobSeeker->id);
            try {
                $text = $this->textExtractionService->extract(Storage::disk('local')->path($stored['path']), $stored['mime_type']);
            } catch (\RuntimeException $exception) {
                $text = '';
            }
            $supportingFile = SupportingFile::create([
                'job_seeker_id' => $jobSeeker->id,
                'doc_type' => $docType,
                'original_name' => $stored['original_name'],
                'saved_name' => $stored['saved_name'],
                'file_path' => $stored['path'],
                'mime_type' => $stored['mime_type'],
                'extracted_text' => $text,
                'size_bytes' => $stored['size_bytes'],
                'uploaded_at' => now(),
            ]);
            $created[] = $supportingFile;
        }

        return response()->json([
            'message' => 'Supporting files uploaded successfully.',
            'files' => $this->serializeSupportingFiles($created),
        ], 201);
    }

    public function downloadSupportingFile(int $id, int $supportId): mixed
    {
        $file = SupportingFile::query()
            ->where('job_seeker_id', $id)
            ->where('id', $supportId)
            ->firstOrFail();

        abort_if(!$file->file_path || !Storage::disk('local')->exists($file->file_path), 404, 'Supporting file not found.');
        return Storage::disk('local')->download($file->file_path, $file->original_name ?: basename($file->file_path));
    }

    public function deleteSupportingFile(int $id, int $supportId): JsonResponse
    {
        $file = SupportingFile::query()
            ->where('job_seeker_id', $id)
            ->where('id', $supportId)
            ->firstOrFail();

        if ($file->file_path && Storage::disk('local')->exists($file->file_path)) {
            Storage::disk('local')->delete($file->file_path);
        }
        $file->delete();

        return response()->json(['message' => 'Supporting file deleted successfully.']);
    }

    public function storeEducation(Request $request, int $id): JsonResponse
    {
        $jobSeeker = JobSeeker::findOrFail($id);
        $data = $request->validate([
            'school_name' => ['nullable', 'string', 'max:255'],
            'degree' => ['nullable', 'string', 'max:255'],
            'start_year' => ['nullable', 'string', 'max:20'],
            'end_year' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string'],
        ]);

        $education = $jobSeeker->educations()->create($data);

        return response()->json($this->serializeEducation($education), 201);
    }

    public function updateEducation(Request $request, int $id, int $educationId): JsonResponse
    {
        $education = Education::query()->where('job_seeker_id', $id)->where('id', $educationId)->firstOrFail();
        $data = $request->validate([
            'school_name' => ['nullable', 'string', 'max:255'],
            'degree' => ['nullable', 'string', 'max:255'],
            'start_year' => ['nullable', 'string', 'max:20'],
            'end_year' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string'],
        ]);

        $education->update($data);

        return response()->json($this->serializeEducation($education));
    }

    public function deleteEducation(int $id, int $educationId): JsonResponse
    {
        $education = Education::query()->where('job_seeker_id', $id)->where('id', $educationId)->firstOrFail();
        $education->delete();
        return response()->json(['message' => 'Education deleted successfully.']);
    }

    public function storeExperience(Request $request, int $id): JsonResponse
    {
        $jobSeeker = JobSeeker::findOrFail($id);
        $data = $request->validate([
            'company_name' => ['nullable', 'string', 'max:255'],
            'position' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'string', 'max:40'],
            'end_date' => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string'],
        ]);

        $experience = $jobSeeker->experiences()->create($data);

        return response()->json($this->serializeExperience($experience), 201);
    }

    public function updateExperience(Request $request, int $id, int $experienceId): JsonResponse
    {
        $experience = Experience::query()->where('job_seeker_id', $id)->where('id', $experienceId)->firstOrFail();
        $data = $request->validate([
            'company_name' => ['nullable', 'string', 'max:255'],
            'position' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'string', 'max:40'],
            'end_date' => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string'],
        ]);

        $experience->update($data);

        return response()->json($this->serializeExperience($experience));
    }

    public function deleteExperience(int $id, int $experienceId): JsonResponse
    {
        $experience = Experience::query()->where('job_seeker_id', $id)->where('id', $experienceId)->firstOrFail();
        $experience->delete();
        return response()->json(['message' => 'Experience deleted successfully.']);
    }

    private function getResumeUpload(int $jobSeekerId): ?Upload
    {
        return Upload::query()
            ->where('job_seeker_id', $jobSeekerId)
            ->where(function ($query) {
                $query->whereNull('applied_job_title')
                    ->orWhere('applied_job_title', '');
            })
            ->orderByDesc('uploaded_at')
            ->orderByDesc('id')
            ->first();
    }

    private function serializeJobSeeker(JobSeeker $jobSeeker, bool $includeMeta = false): array
    {
        $base = [
            'id' => $jobSeeker->id,
            'full_name' => $jobSeeker->full_name,
            'fullName' => $jobSeeker->full_name,
            'email' => $jobSeeker->email,
            'username' => $jobSeeker->username,
            'phone' => $jobSeeker->phone,
            'status' => $jobSeeker->status,
            'address' => $jobSeeker->address,
            'about_text' => $jobSeeker->about_text,
            'aboutText' => $jobSeeker->about_text,
            'created_at' => $jobSeeker->created_at?->toISOString(),
            'createdAt' => $jobSeeker->created_at?->toISOString(),
            'updated_at' => $jobSeeker->updated_at?->toISOString(),
            'updatedAt' => $jobSeeker->updated_at?->toISOString(),
        ];

        if ($includeMeta) {
            $base['educations_count'] = $jobSeeker->educations->count();
            $base['experiences_count'] = $jobSeeker->experiences->count();
        }

        return $base;
    }

    private function serializeResume(?Upload $resume): ?array
    {
        if (!$resume) {
            return null;
        }

        $uploadedAt = $resume->uploaded_at instanceof \DateTimeInterface
            ? $resume->uploaded_at->toISOString()
            : ($resume->uploaded_at ? (string) $resume->uploaded_at : null);

        return [
            'id' => $resume->id,
            'job_seeker_id' => $resume->job_seeker_id,
            'name' => $resume->original_name ?: $resume->name,
            'mimeType' => $resume->mime_type,
            'mime_type' => $resume->mime_type,
            'original_name' => $resume->original_name,
            'saved_name' => $resume->saved_name,
            'file_path' => $resume->file_path,
            'classification' => $resume->classification,
            'match_score' => $resume->match_score,
            'project_score' => $resume->project_score,
            'matched_job_title' => $resume->matched_job_title,
            'matched_skills' => $resume->matched_skills,
            'missing_skills' => $resume->missing_skills,
            'education_text' => $resume->education_text,
            'education_json' => $resume->education_json,
            'experience_text' => $resume->experience_text,
            'extracted_text' => $resume->extracted_text,
            'experience_json' => $resume->experience_json,
            'summary_text' => $resume->summary_text,
            'resume_summary' => $resume->resume_summary ?? [],
            'uploaded_at' => $uploadedAt,
            'updatedAt' => $uploadedAt,
            'updated_at' => $uploadedAt,
            'size_bytes' => $resume->size_bytes,
            'download_url' => url("/api/job-seekers/{$resume->job_seeker_id}/resume/download"),
        ];
    }

    private function serializeSupportingFiles(iterable $files): array
    {
        return collect($files)->map(function ($file) {
            return [
                'id' => $file->id,
                'job_seeker_id' => $file->job_seeker_id,
                'doc_type' => $file->doc_type,
                'type' => $file->doc_type,
                'original_name' => $file->original_name,
                'originalName' => $file->original_name,
                'saved_name' => $file->saved_name,
                'savedName' => $file->saved_name,
                'file_path' => $file->file_path,
                'mime_type' => $file->mime_type,
                'mimeType' => $file->mime_type,
                'extracted_text' => $file->extracted_text,
                'size_bytes' => $file->size_bytes,
                'uploaded_at' => $file->uploaded_at,
                'download_url' => url("/api/job-seekers/{$file->job_seeker_id}/supporting/{$file->id}/download"),
            ];
        })->values()->all();
    }

    private function serializeEducation(Education $education): array
    {
        return [
            'id' => $education->id,
            'job_seeker_id' => $education->job_seeker_id,
            'school_name' => $education->school_name,
            'schoolName' => $education->school_name,
            'school' => $education->school_name,
            'degree' => $education->degree,
            'start_year' => $education->start_year,
            'startYear' => $education->start_year,
            'end_year' => $education->end_year,
            'endYear' => $education->end_year,
            'description' => $education->description,
            'program' => $education->degree,
            'year' => trim(implode(' - ', array_filter([$education->start_year, $education->end_year]))),
        ];
    }

    private function serializeExperience(Experience $experience): array
    {
        return [
            'id' => $experience->id,
            'job_seeker_id' => $experience->job_seeker_id,
            'company_name' => $experience->company_name,
            'companyName' => $experience->company_name,
            'company' => $experience->company_name,
            'position' => $experience->position,
            'start_date' => $experience->start_date,
            'startDate' => $experience->start_date,
            'end_date' => $experience->end_date,
            'endDate' => $experience->end_date,
            'description' => $experience->description,
            'title' => $experience->position,
            'year' => trim(implode(' - ', array_filter([$experience->start_date, $experience->end_date]))),
        ];
    }

    private function extractExistingSupportingText(int $jobSeekerId): string
    {
        $texts = [];
        $files = SupportingFile::query()
            ->where('job_seeker_id', $jobSeekerId)
            ->orderByDesc('id')
            ->get();

        foreach ($files as $file) {
            if (trim((string) $file->extracted_text) !== '') {
                $texts[] = $file->extracted_text;
                continue;
            }

            if (!$file->file_path || !Storage::disk('local')->exists($file->file_path)) {
                continue;
            }

            try {
                $text = $this->textExtractionService->extract(Storage::disk('local')->path($file->file_path), $file->mime_type);
            } catch (\RuntimeException $exception) {
                $text = '';
            }

            if (trim($text) !== '') {
                $file->fill(['extracted_text' => $text])->save();
                $texts[] = $text;
            }
        }

        return trim(implode("\n", $texts));
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
}
