<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ApplicationRating;
use App\Models\Archive;
use App\Models\Job;
use App\Models\JobSeeker;
use App\Models\SupportingFile;
use App\Models\Upload;
use App\Notifications\ApplicationShortlistedNotification;
use App\Services\PdsExtractionService;
use App\Services\ResumeAnalysisService;
use App\Services\TextExtractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class UploadController extends Controller
{
    private const APPLICATION_MINIMUM_MATCH_SCORE = 50;
    private const MINIMUM_RATED_BOARD_MEMBER_COUNT = 4;

    public function __construct(
        private readonly ResumeAnalysisService $resumeAnalysisService,
        private readonly PdsExtractionService $pdsExtractionService,
        private readonly TextExtractionService $textExtractionService
    ) {
    }

    public function index(): JsonResponse
    {
        $uploads = Upload::query()
            ->applications()
            ->with(['supportingFiles', 'ratings', 'jobSeeker', 'job'])
            ->orderBy('uploaded_at')
            ->orderBy('id')
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
            'jobId' => ['nullable', 'integer', 'exists:jobs,id'],
            'supportingTypes' => ['nullable'],
            'supportingFiles' => ['nullable'],
            'jobSeekerId' => ['nullable', 'integer'],
            'baseMatchScore' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'totalMatchScore' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'matchScore' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'matchBonusPercentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        /** @var UploadedFile $file */
        $file = $data['file'];

        Job::closeExpiredActiveJobs();
        $appliedJobTitle = trim((string) ($data['appliedJobTitle'] ?? ''));
        $appliedJob = null;
        if (!empty($data['jobId'])) {
            $appliedJob = Job::query()->find((int) $data['jobId']);
            if ($appliedJob && $appliedJobTitle === '') {
                $appliedJobTitle = (string) $appliedJob->title;
            }
        }
        if (!$appliedJob && $appliedJobTitle !== '') {
            $appliedJob = Job::query()
                ->whereRaw('LOWER(title) = ?', [Str::lower($appliedJobTitle)])
                ->orderByDesc('id')
                ->first();
        }

        if ($appliedJob && Str::lower((string) $appliedJob->status) !== 'active') {
            return response()->json([
                'message' => 'This job posting is already closed.',
            ], 422);
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
        $jobSeeker->loadMissing(['educations', 'experiences', 'supportingFiles']);
        $profileOverride = $this->profileOverrideForJobSeeker($jobSeeker);

        $stored = $this->storeFile($file, 'uploads/resumes');
        $supportingText = trim(implode("\n", array_filter([
            $this->extractExistingSupportingTextForJobSeeker($jobSeeker->id),
            $this->extractSupportingTextFromRequest($request),
        ], fn ($text) => trim((string) $text) !== '')));
        $analysisPath = Storage::disk('local')->path($stored['path']);
        $analysisMimeType = $stored['mime_type'];
        $profileResume = $this->getProfileResumeUpload($jobSeeker->id);
        if ($profileResume?->file_path && Storage::disk('local')->exists($profileResume->file_path)) {
            $analysisPath = Storage::disk('local')->path($profileResume->file_path);
            $analysisMimeType = $profileResume->mime_type;
        }

        try {
            $analysis = $this->resumeAnalysisService->analyzeFile(
                $analysisPath,
                $analysisMimeType,
                $appliedJobTitle,
                $supportingText,
                $appliedJob?->id,
                $profileOverride
            );
        } catch (\RuntimeException $exception) {
            $analysis = [
                'classification' => 'Lowly Qualified',
                'overall_score' => 0,
                'skills_match_score' => 0,
                'project_score' => 0,
                'education_match_score' => 0,
                'experience_match_score' => 0,
                'matched_job_title' => $appliedJobTitle !== '' ? $appliedJobTitle : null,
                'matched_skills' => [],
                'missing_skills' => [],
                'education_text' => '',
                'experience_text' => '',
                'resume_text' => '',
                'summary_text' => '',
                'resume_summary' => [],
            ];
        }

        $effectiveMatchScore = (float) ($analysis['overall_score'] ?? 0);
        $providedMatchScore = $data['totalMatchScore'] ?? $data['matchScore'] ?? null;
        if ($providedMatchScore !== null) {
            $effectiveMatchScore = min(100, (float) $providedMatchScore);
        }
        $minimumMatchScore = (float) ($analysis['application_minimum_score'] ?? self::APPLICATION_MINIMUM_MATCH_SCORE);
        if ($appliedJobTitle !== '' && $effectiveMatchScore < $minimumMatchScore) {
            Storage::disk('local')->delete($stored['path']);
            return response()->json([
                'message' => 'Your resume does not match this job enough to apply.',
            ], 422);
        }
        $finalClassification = $this->classificationForMatchScore($effectiveMatchScore);

        if ($appliedJob?->id || $appliedJobTitle !== '') {
            $alreadyApplied = Upload::query()
                ->where('job_seeker_id', $jobSeeker->id)
                ->where(function ($query) {
                    $query->where('job_seeker_hidden', false)
                        ->orWhereNull('job_seeker_hidden');
                })
                ->where(function ($query) {
                    $query->whereNull('evaluation_status')
                        ->orWhereRaw('LOWER(evaluation_status) <> ?', ['cancelled']);
                })
                ->where(function ($query) use ($appliedJob, $appliedJobTitle) {
                    if ($appliedJob?->id) {
                        $query->where('job_id', $appliedJob->id);
                    }

                    if ($appliedJobTitle !== '') {
                        $legacyTitleCheck = function ($legacyQuery) use ($appliedJobTitle) {
                            $legacyQuery
                                ->whereNull('job_id')
                                ->whereRaw('LOWER(applied_job_title) = ?', [Str::lower($appliedJobTitle)]);
                        };

                        if ($appliedJob?->id) {
                            $query->orWhere($legacyTitleCheck);
                        } else {
                            $query->where($legacyTitleCheck);
                        }
                    }
                })
                ->exists();

            if ($alreadyApplied) {
                Storage::disk('local')->delete($stored['path']);
                return response()->json([
                    'message' => 'You already applied to this job.',
                ], 422);
            }
        }

        $upload = Upload::create([
            'job_seeker_id' => $jobSeeker?->id,
            'job_seeker_id_number' => $jobSeeker?->id_number,
            'job_id' => $appliedJob?->id,
            'job_position_type' => $appliedJob?->job_position,
            'name' => $data['name'],
            'email' => Str::lower(trim($data['email'])),
            'phone' => $data['phone'] ?? null,
            'applied_job_title' => $appliedJobTitle !== '' ? $appliedJobTitle : null,
            'original_name' => $stored['original_name'],
            'saved_name' => $stored['saved_name'],
            'file_path' => $stored['path'],
            'mime_type' => $stored['mime_type'],
            'classification' => $finalClassification,
            'match_score' => $effectiveMatchScore,
            'skills_match_score' => $analysis['skills_match_score'] ?? null,
            'project_score' => $analysis['project_score'] ?? $analysis['skills_match_score'] ?? 0,
            'education_match_score' => $analysis['education_match_score'] ?? null,
            'experience_match_score' => $analysis['experience_match_score'] ?? null,
            'matched_job_title' => $analysis['matched_job_title'],
            'matched_skills' => $analysis['matched_skills'],
            'missing_skills' => $analysis['missing_skills'],
            'education_text' => $analysis['education_text'],
            'experience_text' => $analysis['experience_text'],
            'extracted_text' => $analysis['resume_text'],
            'summary_text' => $analysis['summary_text'] ?? '',
            'resume_summary' => $analysis['resume_summary'] ?? [],
            'experience_json' => array_values(array_filter(array_map(
                'trim',
                preg_split("/\n+/", (string) ($analysis['experience_text'] ?? '')) ?: []
            ))),
            'job_seeker_hidden' => false,
            'job_seeker_hidden_at' => null,
            'evaluation_status' => 'pending',
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
                'extracted_text' => $text,
                'size_bytes' => $storedSupporting['size_bytes'],
                'uploaded_at' => now(),
            ]);
        }

        $upload->load(['supportingFiles', 'jobSeeker', 'job']);
        $this->recordPersonnelActivity($request, 'application.created', "Added application for {$upload->name}.", [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'email' => $upload->email,
                'classification' => $upload->classification,
                'matchScore' => $upload->match_score,
            ],
        ]);

        return response()->json($this->serializeUpload($upload), 201);
    }

    public function show(int $id): JsonResponse
    {
        $upload = Upload::query()->with(['supportingFiles', 'ratings', 'jobSeeker', 'job'])->findOrFail($id);
        return response()->json($this->serializeUpload($upload));
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $upload = Upload::query()
            ->with(['supportingFiles', 'ratings', 'jobSeeker', 'job'])
            ->findOrFail($id);

        $data = $request->validate([
            'status' => ['required', 'string', 'in:pending,reviewed,shortlisted,interview,rejected,hired'],
        ]);

        $nextStatus = $data['status'];
        $currentStatus = $this->applicationStatus($upload);
        if ($nextStatus === 'reviewed' && !in_array($currentStatus, ['pending', 'reviewed'], true)) {
            return response()->json($this->serializeUpload($upload));
        }

        $upload->evaluation_status = $nextStatus;
        if ($nextStatus === 'interview' && !$upload->evaluation_started_at) {
            $upload->evaluation_started_at = now();
        }
        $upload->save();

        if ($nextStatus === 'shortlisted' && $currentStatus !== 'shortlisted') {
            $this->sendShortlistedNotification($request, $upload->fresh(['jobSeeker', 'job']));
        }

        $event = match ($nextStatus) {
            'reviewed' => 'application.reviewed',
            'shortlisted' => 'application.shortlisted',
            'interview' => 'application.interviewed',
            'rejected' => 'application.rejected',
            'hired' => 'application.hired',
            default => 'application.status_updated',
        };
        $description = match ($nextStatus) {
            'reviewed' => "Reviewed application for {$upload->name}.",
            'shortlisted' => "Shortlisted {$upload->name} for interview.",
            'interview' => "Moved {$upload->name} to interview.",
            'rejected' => "Rejected application for {$upload->name}.",
            'hired' => "Marked {$upload->name} as hired.",
            default => "Updated application status for {$upload->name}.",
        };

        $this->recordPersonnelActivity($request, $event, $description, [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'status' => $nextStatus,
            ],
        ]);

        return response()->json($this->serializeUpload($upload->fresh(['supportingFiles', 'ratings', 'jobSeeker', 'job'])));
    }

    private function sendShortlistedNotification(Request $request, ?Upload $upload): void
    {
        if (!$upload) {
            return;
        }

        $recipientEmail = Str::lower(trim((string) ($upload->email ?: $upload->jobSeeker?->email)));
        if ($recipientEmail === '') {
            return;
        }

        $actor = Archive::actorFromRequest($request);
        $personnelName = trim((string) ($actor['actor_name'] ?? ''));
        $personnelEmail = trim((string) ($actor['actor_email'] ?? ''));
        $jobTitle = trim((string) ($upload->applied_job_title ?: $upload->matched_job_title ?: $upload->job?->title ?: 'your applied position'));
        $applicantName = trim((string) ($upload->name ?: $upload->jobSeeker?->full_name ?: 'Applicant'));

        try {
            NotificationFacade::route('mail', $recipientEmail)->notify(
                new ApplicationShortlistedNotification(
                    $applicantName,
                    $jobTitle,
                    $personnelName !== '' ? $personnelName : null,
                    $personnelEmail !== '' ? $personnelEmail : null
                )
            );
        } catch (Throwable $error) {
            Log::warning('Failed to send shortlisted application email.', [
                'upload_id' => $upload->id,
                'recipient' => $recipientEmail,
                'message' => $error->getMessage(),
            ]);
        }
    }

    public function reanalyze(Request $request, int $id): JsonResponse
    {
        $upload = Upload::query()->with(['supportingFiles', 'jobSeeker.educations', 'jobSeeker.experiences', 'jobSeeker.supportingFiles'])->findOrFail($id);
        $data = $request->validate([
            'file' => ['nullable', 'file', 'max:6144'],
        ]);

        $stored = [
            'path' => $upload->file_path,
            'mime_type' => $upload->mime_type,
            'original_name' => $upload->original_name,
            'saved_name' => $upload->saved_name,
        ];

        if (!empty($data['file'])) {
            /** @var UploadedFile $file */
            $file = $data['file'];
            if ($upload->file_path && Storage::disk('local')->exists($upload->file_path)) {
                Storage::disk('local')->delete($upload->file_path);
            }
            $stored = $this->storeFile($file, 'uploads/resumes');
        }

        if (!$stored['path'] || !Storage::disk('local')->exists($stored['path'])) {
            return response()->json([
                'message' => 'Resume file not found for re-analysis.',
            ], 404);
        }

        try {
            $analysis = $this->resumeAnalysisService->analyzeFile(
                Storage::disk('local')->path($stored['path']),
                $stored['mime_type'],
                (string) ($upload->applied_job_title ?? ''),
                $this->extractExistingSupportingText($upload),
                $upload->job_id,
                $upload->jobSeeker ? $this->profileOverrideForJobSeeker($upload->jobSeeker) : []
            );
        } catch (\RuntimeException $exception) {
            $analysis = [
                'classification' => 'Lowly Qualified',
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
                'summary_text' => '',
                'resume_summary' => [],
            ];
        }

        $reanalyzedScore = (float) ($analysis['overall_score'] ?? 0);
        $minimumMatchScore = (float) ($analysis['application_minimum_score'] ?? self::APPLICATION_MINIMUM_MATCH_SCORE);

        $upload->fill([
            'original_name' => $stored['original_name'],
            'saved_name' => $stored['saved_name'],
            'file_path' => $stored['path'],
            'mime_type' => $stored['mime_type'],
            'classification' => $this->classificationForMatchScore($reanalyzedScore),
            'match_score' => $reanalyzedScore,
            'skills_match_score' => $analysis['skills_match_score'] ?? null,
            'project_score' => $analysis['project_score'] ?? $analysis['skills_match_score'] ?? 0,
            'education_match_score' => $analysis['education_match_score'] ?? null,
            'experience_match_score' => $analysis['experience_match_score'] ?? null,
            'matched_job_title' => $analysis['matched_job_title'],
            'matched_skills' => $analysis['matched_skills'],
            'missing_skills' => $analysis['missing_skills'],
            'education_text' => $analysis['education_text'],
            'experience_text' => $analysis['experience_text'],
            'extracted_text' => $analysis['resume_text'],
            'summary_text' => $analysis['summary_text'] ?? '',
            'resume_summary' => $analysis['resume_summary'] ?? [],
            'experience_json' => array_values(array_filter(array_map(
                'trim',
                preg_split("/\n+/", (string) ($analysis['experience_text'] ?? '')) ?: []
            ))),
        ])->save();

        $refreshedUpload = $upload->fresh(['supportingFiles', 'jobSeeker', 'job']);
        $this->recordPersonnelActivity($request, 'application.reanalyzed', "Reanalyzed application for {$upload->name}.", [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'classification' => $upload->classification,
                'matchScore' => $upload->match_score,
            ],
        ]);

        return response()->json([
            'message' => 'Application reanalyzed successfully.',
            'upload' => $this->serializeUpload($refreshedUpload),
        ]);
    }

    public function download(Request $request, int $id): mixed
    {
        $upload = Upload::findOrFail($id);
        abort_if(!$upload->file_path || !Storage::disk('local')->exists($upload->file_path), 404, 'Upload not found.');

        $this->recordPersonnelActivity($request, 'application.resume_downloaded', "Downloaded resume for {$upload->name}.", [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'email' => $upload->email,
                'fileName' => $upload->original_name,
            ],
        ]);

        return Storage::disk('local')->download($upload->file_path, $upload->original_name ?: basename($upload->file_path));
    }

    public function supporting(int $id): JsonResponse
    {
        $upload = Upload::query()->with('supportingFiles')->findOrFail($id);
        return response()->json([
            'files' => $upload->supportingFiles->map(fn (SupportingFile $file) => $this->serializeSupportingFile($file, $upload->id))->values(),
        ]);
    }

    public function supportingDownload(Request $request, int $id, int $supportId): mixed
    {
        $upload = Upload::findOrFail($id);
        $file = SupportingFile::query()
            ->where('job_seeker_id', $upload->job_seeker_id)
            ->where('id', $supportId)
            ->firstOrFail();
        abort_if(!$file->file_path || !Storage::disk('local')->exists($file->file_path), 404, 'Supporting file not found.');

        $this->recordPersonnelActivity($request, 'application.supporting_downloaded', "Downloaded supporting document for {$upload->name}.", [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'email' => $upload->email,
                'fileName' => $file->original_name,
                'documentType' => $file->doc_type,
            ],
        ]);

        return Storage::disk('local')->download($file->file_path, $file->original_name ?: basename($file->file_path));
    }

    public function exportRatingSummary(Request $request, int $id): mixed
    {
        $upload = Upload::query()->with(['ratings', 'jobSeeker'])->findOrFail($id);
        if (!in_array($this->applicationStatus($upload), ['hired'], true) && !$this->hasMinimumBoardMemberRatings($upload)) {
            return response()->json([
                'message' => 'Rating summary can only be exported after the application is hired.',
            ], 422);
        }

        $ratings = $this->ratingsForFormType($upload, 'interview');
        if ($ratings->isEmpty()) {
            return response()->json([
                'message' => 'Interview rating summary can only be exported after an interview rating is saved.',
            ], 422);
        }

        $stats = $this->ratingStats($upload, 'interview');
        $phone = $this->formatPhoneForExcel($upload->phone);
        $rows = [
            ['Applicant Name', $upload->name ?: '-'],
            ['Unique ID', $upload->job_seeker_id_number ?: $upload->jobSeeker?->id_number ?: '-'],
            ['Email', $upload->email ?: '-'],
            ['Phone', $phone, true],
            ['Position Applied', $upload->applied_job_title ?: $upload->matched_job_title ?: '-'],
            ['Date of Interview', $upload->uploaded_at?->format('F j, Y') ?: '-'],
            ['Application Status', 'Hired'],
            ['Classification', $upload->classification ?: '-'],
            ['Match Score', $upload->match_score !== null ? round((float) $upload->match_score, 2) . '%' : '-'],
            ['Average Rating', $stats['average'] !== null ? $stats['average'] . '%' : '-'],
            ['Rating Count', $stats['count']],
        ];

        $criteria = $ratings
            ->flatMap(fn (ApplicationRating $rating) => array_keys($rating->scores ?? []))
            ->unique()
            ->values();
        $ratingColumnSpan = 2 + $ratings->count();

        $html = '<html><head><meta charset="UTF-8">';
        $html .= '<style>
            @page { size: A4 landscape; margin: 0.35in; mso-page-orientation: landscape; }
            body { font-family: Arial, sans-serif; color: #172033; }
            table { border-collapse: collapse; margin: 0; table-layout: fixed; width: 100%; }
            th, td {
                border: 1px solid #b8c4d8;
                padding: 4px 5px;
                vertical-align: middle;
                text-align: center;
                font-size: 10px;
                line-height: 1.2;
                white-space: normal;
                word-wrap: break-word;
            }
            .title { background: #0f2f82; color: #ffffff; font-size: 16px; font-weight: 700; }
            .subtitle { background: #eaf0ff; color: #172033; font-size: 10px; }
            .section { background: #163d9b; color: #ffffff; font-weight: 700; font-size: 12px; }
            .label { background: #f3f6fb; color: #172033; font-weight: 700; width: 190px; }
            .value { width: 330px; mso-number-format:"\@"; }
            .head { background: #dbe6ff; color: #10245a; font-weight: 700; }
            .center { text-align: center; }
            .text { mso-number-format:"\@"; }
            .muted { color: #64748b; }
            .print-wide { mso-fit-to-page: yes; }
            .rating-label-col { width: 185px; }
            .rating-member-col { width: 90px; }
            .rating-average-col { width: 72px; }
            .signature-wrap { margin-top: 28px; width: 100%; table-layout: fixed; }
            .signature-wrap td { border: none; padding: 5px; font-size: 10px; text-align: left; }
            .signature-line { border-bottom: 1px solid #172033 !important; height: 24px; }
            .signature-caption { color: #172033; font-weight: 700; text-align: center !important; }
        </style>';
        $html .= '</head><body>';
        $html .= '<table class="print-wide">';
        $html .= '<colgroup><col style="width:210px"><col style="width:390px"></colgroup>';
        $html .= '<tr><th class="title" colspan="2">Application Rating Summary</th></tr>';
        $html .= '<tr><td class="subtitle" colspan="2">Generated on ' . $this->excelCell(now()->format('F j, Y g:i A')) . '</td></tr>';
        $html .= '<tr><th class="section" colspan="2">Applicant Information</th></tr>';
        foreach ($rows as $row) {
            $value = ($row[2] ?? false) ? $this->excelTextFormula($row[1]) : $this->excelCell($row[1]);
            $html .= '<tr><th class="label">' . $this->excelCell($row[0]) . '</th><td class="value text">' . $value . '</td></tr>';
        }
        $html .= '</table><br>';
        $html .= '<table class="print-wide">';
        $html .= '<colgroup><col class="rating-label-col">';
        foreach ($ratings as $rating) {
            $html .= '<col class="rating-member-col">';
        }
        $html .= '<col class="rating-average-col"></colgroup>';
        $html .= '<tr><th class="section" colspan="' . $ratingColumnSpan . '">Board Member Ratings</th></tr>';
        $html .= '<tr>';
        $html .= '<th class="head">Board Member</th>';
        foreach ($ratings as $rating) {
            $html .= '<th class="head">' . $this->excelCell($rating->rater_name ?: 'Board member') . '</th>';
        }
        $html .= '<th class="head">Average</th>';
        $html .= '</tr>';
        $html .= '<tr>';
        $html .= '<th class="label">Date Rated</th>';
        foreach ($ratings as $rating) {
            $html .= '<td class="text">' . $this->excelCell($rating->created_at?->format('F j, Y g:i A') ?: '-') . '</td>';
        }
        $html .= '<td class="muted">-</td>';
        $html .= '</tr>';
        foreach ($criteria as $criterion) {
            $criterionScores = $ratings
                ->map(fn (ApplicationRating $rating) => collect($rating->scores ?? [])->get($criterion))
                ->filter(fn ($score) => is_numeric($score));
            $criterionAverage = $criterionScores->count() > 0
                ? round((float) $criterionScores->avg(), 2)
                : '-';

            $html .= '<tr>';
            $html .= '<th class="label">' . $this->excelCell($criterion) . '</th>';
            foreach ($ratings as $rating) {
                $scores = collect($rating->scores ?? []);
                $html .= '<td class="text">' . $this->excelCell($scores->get($criterion, '-')) . '</td>';
            }
            $html .= '<td class="text">' . $this->excelCell($criterionAverage) . '</td>';
            $html .= '</tr>';
        }
        $html .= '<tr>';
        $html .= '<th class="label">Total Score</th>';
        foreach ($ratings as $rating) {
            $scores = collect($rating->scores ?? []);
            $possibleScore = max(1, $scores->count()) * 5;
            $html .= '<td class="text">' . $this->excelCell($rating->total_score . '/' . $possibleScore) . '</td>';
        }
        $html .= '<td class="text"><strong>' . $this->excelCell($stats['average'] !== null ? $stats['average'] . '%' : '-') . '</strong></td>';
        $html .= '</tr>';
        $html .= '<tr>';
        $html .= '<th class="label">Percentage</th>';
        foreach ($ratings as $rating) {
            $html .= '<td class="text">' . $this->excelCell(round((float) $rating->percentage_score, 2) . '%') . '</td>';
        }
        $html .= '<td class="text"><strong>' . $this->excelCell($stats['average'] !== null ? $stats['average'] . '%' : '-') . '</strong></td>';
        $html .= '</tr>';
        $html .= '<tr>';
        $html .= '<th class="label">Remarks</th>';
        foreach ($ratings as $rating) {
            $html .= '<td class="text">' . $this->excelCell($this->userRatingRemarks($rating)) . '</td>';
        }
        $html .= '<td class="muted">-</td>';
        $html .= '</tr>';
        $html .= '</table>';
        $html .= $this->excelSignatureBlock();
        $html .= '</body></html>';

        ActivityLog::record('application.summary_downloaded', "Downloaded rating summary for {$upload->name}.", $request, [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'format' => 'xls',
            ],
        ]);

        $safeName = Str::slug($upload->name ?: 'application');
        return response($html, 200, [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"rating-summary-{$safeName}.xls\"",
        ]);
    }

    public function exportDemonstrationSummary(Request $request, int $id): mixed
    {
        $upload = Upload::query()->with(['ratings', 'jobSeeker'])->findOrFail($id);
        $ratings = $this->ratingsForFormType($upload, 'demonstration');
        if ($ratings->isEmpty()) {
            return response()->json([
                'message' => 'Demonstration summary can only be exported after a demonstration rating is saved.',
            ], 422);
        }

        $stats = $this->ratingStats($upload, 'demonstration');
        $phone = $this->formatPhoneForExcel($upload->phone);
        $rows = [
            ['Applicant Name', $upload->name ?: '-'],
            ['Unique ID', $upload->job_seeker_id_number ?: $upload->jobSeeker?->id_number ?: '-'],
            ['Email', $upload->email ?: '-'],
            ['Phone', $phone, true],
            ['Position Applied', $upload->applied_job_title ?: $upload->matched_job_title ?: '-'],
            ['Generated Form', 'Applicant Demonstration Form'],
            ['Average Demonstration Rating', $stats['average'] !== null ? $stats['average'] . '%' : '-'],
            ['Rating Count', $stats['count']],
        ];

        $criteria = $ratings
            ->flatMap(fn (ApplicationRating $rating) => array_keys($rating->scores ?? []))
            ->unique()
            ->values();
        $ratingColumnSpan = 2 + $ratings->count();

        $html = '<html><head><meta charset="UTF-8">';
        $html .= '<style>
            @page { size: A4 landscape; margin: 0.35in; mso-page-orientation: landscape; }
            body { font-family: Arial, sans-serif; color: #172033; }
            table { border-collapse: collapse; margin: 0; table-layout: fixed; width: 100%; }
            th, td {
                border: 1px solid #b8c4d8;
                padding: 4px 5px;
                vertical-align: middle;
                text-align: center;
                font-size: 10px;
                line-height: 1.2;
                white-space: normal;
                word-wrap: break-word;
            }
            .title { background: #175c49; color: #ffffff; font-size: 16px; font-weight: 700; }
            .subtitle { background: #e8f7f1; color: #172033; font-size: 10px; }
            .section { background: #20735c; color: #ffffff; font-weight: 700; font-size: 12px; }
            .label { background: #f3f6fb; color: #172033; font-weight: 700; width: 190px; }
            .value { width: 330px; mso-number-format:"\@"; }
            .head { background: #d8f1e8; color: #114336; font-weight: 700; }
            .text { mso-number-format:"\@"; }
            .muted { color: #64748b; }
            .print-wide { mso-fit-to-page: yes; }
            .rating-label-col { width: 215px; }
            .rating-member-col { width: 90px; }
            .rating-average-col { width: 72px; }
            .signature-wrap { margin-top: 28px; width: 100%; table-layout: fixed; }
            .signature-wrap td { border: none; padding: 5px; font-size: 10px; text-align: left; }
            .signature-line { border-bottom: 1px solid #172033 !important; height: 24px; }
            .signature-caption { color: #172033; font-weight: 700; text-align: center !important; }
        </style>';
        $html .= '</head><body>';
        $html .= '<table class="print-wide">';
        $html .= '<colgroup><col style="width:210px"><col style="width:390px"></colgroup>';
        $html .= '<tr><th class="title" colspan="2">Applicant Demonstration Form Summary</th></tr>';
        $html .= '<tr><td class="subtitle" colspan="2">Generated on ' . $this->excelCell(now()->format('F j, Y g:i A')) . '</td></tr>';
        $html .= '<tr><th class="section" colspan="2">Applicant Information</th></tr>';
        foreach ($rows as $row) {
            $value = ($row[2] ?? false) ? $this->excelTextFormula($row[1]) : $this->excelCell($row[1]);
            $html .= '<tr><th class="label">' . $this->excelCell($row[0]) . '</th><td class="value text">' . $value . '</td></tr>';
        }
        $html .= '</table><br>';
        $html .= '<table class="print-wide">';
        $html .= '<colgroup><col class="rating-label-col">';
        foreach ($ratings as $rating) {
            $html .= '<col class="rating-member-col">';
        }
        $html .= '<col class="rating-average-col"></colgroup>';
        $html .= '<tr><th class="section" colspan="' . $ratingColumnSpan . '">Demonstration Ratings</th></tr>';
        $html .= '<tr><th class="head">Criteria</th>';
        foreach ($ratings as $rating) {
            $html .= '<th class="head">' . $this->excelCell($rating->rater_name ?: 'Observer') . '</th>';
        }
        $html .= '<th class="head">Average</th></tr>';
        $html .= '<tr><th class="label">Date Rated</th>';
        foreach ($ratings as $rating) {
            $html .= '<td class="text">' . $this->excelCell($rating->created_at?->format('F j, Y g:i A') ?: '-') . '</td>';
        }
        $html .= '<td class="muted">-</td></tr>';

        foreach ($criteria as $criterion) {
            $criterionScores = $ratings
                ->map(fn (ApplicationRating $rating) => collect($rating->scores ?? [])->get($criterion))
                ->filter(fn ($score) => is_numeric($score) && (float) $score > 0);
            $criterionAverage = $criterionScores->count() > 0
                ? round((float) $criterionScores->avg(), 2)
                : '-';

            $html .= '<tr>';
            $html .= '<th class="label">' . $this->excelCell($this->demonstrationCriterionLabel((string) $criterion)) . '</th>';
            foreach ($ratings as $rating) {
                $score = collect($rating->scores ?? [])->get($criterion, '-');
                $html .= '<td class="text">' . $this->excelCell((string) $score === '0' ? 'NA' : $score) . '</td>';
            }
            $html .= '<td class="text">' . $this->excelCell($criterionAverage) . '</td>';
            $html .= '</tr>';
        }

        $html .= '<tr><th class="label">Total Score</th>';
        foreach ($ratings as $rating) {
            $scores = collect($rating->scores ?? []);
            $possibleScore = max(1, $scores->filter(fn ($score) => (float) $score > 0)->count()) * 5;
            $html .= '<td class="text">' . $this->excelCell($rating->total_score . '/' . $possibleScore) . '</td>';
        }
        $html .= '<td class="text"><strong>' . $this->excelCell($stats['average'] !== null ? $stats['average'] . '%' : '-') . '</strong></td></tr>';
        $html .= '<tr><th class="label">Percentage</th>';
        foreach ($ratings as $rating) {
            $html .= '<td class="text">' . $this->excelCell(round((float) $rating->percentage_score, 2) . '%') . '</td>';
        }
        $html .= '<td class="text"><strong>' . $this->excelCell($stats['average'] !== null ? $stats['average'] . '%' : '-') . '</strong></td></tr>';
        $html .= '<tr><th class="label">Remarks / Details</th>';
        foreach ($ratings as $rating) {
            $html .= '<td class="text">' . $this->excelCell($this->userRatingRemarks($rating)) . '</td>';
        }
        $html .= '<td class="muted">-</td></tr>';
        $html .= '</table>';
        $html .= $this->excelSignatureBlock();
        $html .= '</body></html>';

        ActivityLog::record('application.demonstration_summary_downloaded', "Downloaded demonstration summary for {$upload->name}.", $request, [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'format' => 'xls',
            ],
        ]);

        $safeName = Str::slug($upload->name ?: 'application');
        return response($html, 200, [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"demonstration-summary-{$safeName}.xls\"",
        ]);
    }

    public function markForEvaluation(Request $request, int $id): JsonResponse
    {
        $upload = Upload::findOrFail($id);
        $upload->evaluation_status = 'interview';
        $upload->evaluation_started_at = now();
        $upload->save();

        ActivityLog::record('application.interviewed', "Moved {$upload->name} to interview.", $request, [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
            ],
        ]);

        return response()->json($this->serializeUpload($upload->fresh(['supportingFiles', 'ratings', 'jobSeeker', 'job'])));
    }

    public function storeRating(Request $request, int $id): JsonResponse
    {
        $upload = Upload::findOrFail($id);
        $data = $request->validate([
            'raterName' => ['nullable', 'string', 'max:255'],
            'raterEmail' => ['nullable', 'string', 'max:255'],
            'boardMembers' => ['nullable', 'array'],
            'boardMembers.*' => ['nullable', 'string', 'max:255'],
            'formType' => ['nullable', 'string', 'in:interview,demonstration'],
            'scores' => ['required', 'array'],
            'scores.*' => ['required', 'integer', 'min:0', 'max:5'],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        $scores = array_map('intval', $data['scores']);
        $totalScore = array_sum($scores);
        $ratedScoreCount = count(array_filter($scores, fn (int $score) => $score > 0));
        $possibleScore = max(1, $ratedScoreCount) * 5;
        $percentageScore = round(($totalScore / $possibleScore) * 100, 2);
        $raterName = trim((string) ($data['raterName'] ?? ''));
        $raterEmail = Str::lower(trim((string) ($data['raterEmail'] ?? '')));
        $formType = ($data['formType'] ?? 'interview') === 'demonstration' ? 'demonstration' : 'interview';

        $alreadyRated = ApplicationRating::query()
            ->where('upload_id', $upload->id)
            ->where(function ($query) use ($raterEmail, $raterName) {
                if ($raterEmail !== '') {
                    $query->whereRaw('LOWER(rater_email) = ?', [$raterEmail]);
                    return;
                }

                $query->whereRaw('LOWER(rater_name) = ?', [Str::lower($raterName)]);
            })
            ->get()
            ->contains(fn (ApplicationRating $rating) => $this->ratingFormType($rating) === $formType);

        if ($alreadyRated) {
            return response()->json([
                'message' => "This board member has already rated this {$formType} form.",
            ], 422);
        }

        ApplicationRating::create([
            'upload_id' => $upload->id,
            'rater_name' => $raterName ?: null,
            'rater_email' => $raterEmail ?: null,
            'scores' => $scores,
            'remarks' => trim((string) ($data['remarks'] ?? '')) ?: null,
            'total_score' => $totalScore,
            'percentage_score' => $percentageScore,
        ]);

        $upload->load('ratings');
        $boardMembers = array_values(array_filter(array_map(
            fn ($member) => trim((string) $member),
            $data['boardMembers'] ?? []
        )));
        $upload->evaluation_status = $this->hasCompletedAllBoardMemberRatings($upload, $boardMembers)
            ? 'hired'
            : 'interview';
        if (!$upload->evaluation_started_at) {
            $upload->evaluation_started_at = now();
        }
        $upload->save();

        ActivityLog::record('application.rated', "Rated {$upload->name} for {$upload->applied_job_title}.", $request, [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'raterName' => $raterName,
                'totalScore' => $totalScore,
                'percentageScore' => $percentageScore,
            ],
        ]);

        return response()->json($this->serializeUpload($upload->fresh(['supportingFiles', 'ratings', 'jobSeeker', 'job'])));
    }

    public function cancelEvaluation(Request $request, int $id): JsonResponse
    {
        $upload = Upload::query()
            ->with(['supportingFiles', 'ratings', 'jobSeeker', 'job'])
            ->findOrFail($id);

        $hadRatings = $upload->ratings->isNotEmpty();
        if ($hadRatings) {
            Archive::create([
                'record_type' => 'rating',
                'record_id' => $upload->id,
                'title' => $upload->name ?: $upload->original_name,
                'subtitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'data' => [
                    'applicant' => $this->serializeUpload($upload),
                    'ratings' => $this->serializeRatings($upload),
                    'rating_count' => $this->ratingStats($upload)['count'],
                    'rating_label' => $this->ratingStats($upload)['label'],
                    'average_rating_score' => $this->ratingStats($upload)['average'],
                ],
                ...Archive::actorFromRequest($request),
                'deleted_at' => now(),
            ]);
        }

        $upload->ratings()->delete();
        $upload->evaluation_status = 'reviewed';
        $upload->evaluation_started_at = null;
        $upload->save();

        ActivityLog::record(
            $hadRatings ? 'rating.deleted' : 'application.cancelled',
            $hadRatings
                ? "Deleted rating record for {$upload->name}."
                : "Cancelled interview evaluation for {$upload->name}.",
            $request,
            [
                'subject_type' => 'application',
                'subject_id' => $upload->id,
                'subject_name' => $upload->name,
                'metadata' => [
                    'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                ],
            ]
        );

        return response()->json($this->serializeUpload($upload->fresh(['supportingFiles', 'ratings', 'jobSeeker', 'job'])));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $upload = Upload::findOrFail($id);

        Archive::create([
            'record_type' => 'application',
            'record_id' => $upload->id,
            'title' => $upload->name ?: $upload->original_name,
            'subtitle' => $upload->applied_job_title ?: $upload->matched_job_title,
            'data' => $this->serializeUpload($upload),
            ...Archive::actorFromRequest($request),
            'deleted_at' => now(),
        ]);

        ActivityLog::record('application.deleted', "Deleted application for {$upload->name}.", $request, [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'email' => $upload->email,
            ],
        ]);

        if ($upload->file_path && Storage::disk('local')->exists($upload->file_path)) {
            Storage::disk('local')->delete($upload->file_path);
        }
        $upload->delete();

        return response()->json(['message' => 'Upload deleted successfully.']);
    }

    public function hide(Request $request, int $id): JsonResponse
    {
        $upload = Upload::findOrFail($id);

        Archive::create([
            'record_type' => 'application',
            'record_id' => $upload->id,
            'title' => $upload->name ?: $upload->original_name,
            'subtitle' => $upload->applied_job_title ?: $upload->matched_job_title,
            'data' => $this->serializeUpload($upload),
            ...Archive::actorFromRequest($request),
            'deleted_at' => now(),
        ]);

        ActivityLog::record('application.cancelled', "Cancelled application for {$upload->name}.", $request, [
            'subject_type' => 'application',
            'subject_id' => $upload->id,
            'subject_name' => $upload->name,
            'metadata' => [
                'jobTitle' => $upload->applied_job_title ?: $upload->matched_job_title,
                'email' => $upload->email,
            ],
        ]);

        $upload->job_seeker_hidden = true;
        $upload->job_seeker_hidden_at = now();
        $upload->evaluation_status = 'cancelled';
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

    private function recordPersonnelActivity(Request $request, string $event, string $description, array $attributes = []): void
    {
        $actor = Archive::actorFromRequest($request);
        $role = Str::lower(trim((string) ($actor['actor_role'] ?? '')));
        $hasActor = !empty($actor['actor_name']) || !empty($actor['actor_email']) || $role !== '';

        if (!$hasActor || $role === 'jobseeker') {
            return;
        }

        ActivityLog::record($event, $description, $request, $attributes);
    }

    private function classificationForMatchScore(float $score): string
    {
        return $score >= 80
            ? 'Highly Qualified'
            : ($score >= 60 ? 'Moderately Qualified' : 'Lowly Qualified');
    }

    private function displayClassification(?string $classification): string
    {
        $value = trim((string) $classification);

        return Str::lower($value) === 'not qualified'
            ? 'Lowly Qualified'
            : ($value !== '' ? $value : 'Lowly Qualified');
    }

    private function getProfileResumeUpload(int $jobSeekerId): ?Upload
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

    private function profileOverrideForJobSeeker(JobSeeker $jobSeeker): array
    {
        $jobSeeker->loadMissing(['educations', 'experiences', 'supportingFiles']);

        $educationLines = $jobSeeker->educations
            ->map(fn ($education) => $this->profileEducationLine($education))
            ->filter()
            ->values()
            ->all();

        $workLines = [];
        $trainingLines = [];
        foreach ($jobSeeker->experiences as $experience) {
            $line = $this->profileExperienceLine($experience);
            if ($line === '') {
                continue;
            }

            if ($this->isTrainingProfileExperience((string) $experience->description)) {
                $trainingLines[] = $line;
            } else {
                $workLines[] = $line;
            }
        }

        $eligibilityLines = $jobSeeker->supportingFiles
            ->filter(fn ($file) => Str::startsWith(Str::lower((string) $file->doc_type), 'eligibility:'))
            ->map(fn ($file) => $this->profileEligibilityLine($file))
            ->filter()
            ->values()
            ->all();

        $sections = [];
        if ($educationLines) {
            $sections[] = "PROFILE EDUCATION (PRIMARY SOURCE)\n".implode("\n", $educationLines);
        }
        if ($workLines) {
            $sections[] = "PROFILE WORK EXPERIENCE (PRIMARY SOURCE)\n".implode("\n", $workLines);
        }
        if ($trainingLines) {
            $sections[] = "PROFILE TRAINING (PRIMARY SOURCE)\n".implode("\n", $trainingLines);
        }
        if ($eligibilityLines) {
            $sections[] = "PROFILE ELIGIBILITY (PRIMARY SOURCE)\n".implode("\n", $eligibilityLines);
        }

        return [
            'text' => trim(implode("\n\n", $sections)),
            'education_lines' => $educationLines,
            'experience_lines' => $workLines,
            'training_lines' => $trainingLines,
            'eligibility_lines' => $eligibilityLines,
        ];
    }

    private function profileEducationLine(object $education): string
    {
        return trim(implode(' | ', array_filter([
            (string) ($education->school_name ?? ''),
            (string) ($education->degree ?? ''),
            trim(implode(' - ', array_filter([(string) ($education->start_year ?? ''), (string) ($education->end_year ?? '')]))),
            (string) ($education->description ?? ''),
        ], fn ($value) => trim((string) $value) !== '')));
    }

    private function profileExperienceLine(object $experience): string
    {
        return trim(implode(' | ', array_filter([
            (string) ($experience->position ?? ''),
            (string) ($experience->company_name ?? ''),
            trim(implode(' - ', array_filter([(string) ($experience->start_date ?? ''), (string) ($experience->end_date ?? '')]))),
            (string) ($experience->description ?? ''),
        ], fn ($value) => trim((string) $value) !== '')));
    }

    private function profileEligibilityLine(object $file): string
    {
        $classification = trim(Str::after((string) $file->doc_type, ':'));

        return trim(implode(' | ', array_filter([
            $classification !== '' ? $classification : 'Eligibility',
            (string) ($file->original_name ?? ''),
        ], fn ($value) => trim((string) $value) !== '')));
    }

    private function isTrainingProfileExperience(string $description): bool
    {
        $description = Str::lower($description);

        return Str::contains($description, [
            'record type: training',
            'number of hours credit:',
            'type of ld classification:',
            'certificate file:',
        ]);
    }

    private function looksLikeTrainingRequirement(string $value): bool
    {
        if (trim($value) === '') {
            return false;
        }

        return preg_match('/\b(?:training|trainings|learning|development|seminar|workshop|course|hours?|hrs?|l&d|intervention)\b/i', $value) === 1;
    }

    private function serializeUpload(Upload $upload): array
    {
        $upload->loadMissing('jobSeeker.supportingFiles');

        $uploadedAt = $upload->uploaded_at instanceof \DateTimeInterface
            ? $upload->uploaded_at->toISOString()
            : ($upload->uploaded_at ? (string) $upload->uploaded_at : null);
        $resumeSummary = $upload->resume_summary ?? [];
        $pdsFormat = $this->pdsFormatForUpload($upload, $resumeSummary);
        if ($pdsFormat !== null) {
            $resumeSummary['pds'] = $pdsFormat;
        }
        $scoreBreakdown = is_array($resumeSummary['score_breakdown'] ?? null) ? $resumeSummary['score_breakdown'] : [];
        $matchedTraining = is_array($resumeSummary['matched_training'] ?? null) ? $resumeSummary['matched_training'] : [];
        $missingTraining = is_array($resumeSummary['missing_training'] ?? null) ? $resumeSummary['missing_training'] : [];
        $staleSkillTraining = array_values(array_filter($missingTraining, fn ($item) => !$this->looksLikeTrainingRequirement((string) $item)));
        $missingTraining = array_values(array_filter($missingTraining, fn ($item) => $this->looksLikeTrainingRequirement((string) $item)));
        $missingSkills = array_values(array_unique(array_filter(array_merge($upload->missing_skills ?? [], $staleSkillTraining))));
        $matchedSkills = is_array($upload->matched_skills ?? null) ? array_values(array_filter($upload->matched_skills)) : [];
        $skillRequirementCount = count($matchedSkills) + count($missingSkills);
        $displaySkillsScore = $skillRequirementCount > 0
            ? round((count($matchedSkills) / max($skillRequirementCount, 1)) * 100, 2)
            : ($upload->skills_match_score ?? ($scoreBreakdown['skills'] ?? null));
        $classification = $upload->match_score !== null
            ? $this->classificationForMatchScore((float) $upload->match_score)
            : $this->displayClassification($upload->classification);
        $ratingStats = $this->ratingStats($upload);
        $evaluationStatus = $this->applicationStatus($upload);
        $eligibilityFiles = $upload->jobSeeker?->supportingFiles
            ? $upload->jobSeeker->supportingFiles
                ->filter(fn ($file) => Str::startsWith(Str::lower((string) $file->doc_type), 'eligibility:'))
                ->values()
            : collect();
        $eligibilityLines = $eligibilityFiles
            ->map(fn ($file) => $this->profileEligibilityLine($file))
            ->filter()
            ->values()
            ->all();
        $eligibilityLines = array_values(array_unique(array_filter(array_merge(
            $eligibilityLines,
            $this->extractedEligibilityLines($upload, $resumeSummary)
        ))));
        $serializedEligibilityFiles = $eligibilityFiles
            ->map(fn (SupportingFile $file) => $this->serializeJobSeekerSupportingFile($file))
            ->values()
            ->all();

        return [
            'id' => $upload->id,
            'job_seeker_id' => $upload->job_seeker_id,
            'jobSeekerId' => $upload->job_seeker_id,
            'job_seeker_id_number' => $upload->job_seeker_id_number ?: $upload->jobSeeker?->id_number,
            'jobSeekerIdNumber' => $upload->job_seeker_id_number ?: $upload->jobSeeker?->id_number,
            'id_number' => $upload->job_seeker_id_number ?: $upload->jobSeeker?->id_number,
            'idNumber' => $upload->job_seeker_id_number ?: $upload->jobSeeker?->id_number,
            'job_id' => $upload->job_id,
            'jobId' => $upload->job_id,
            'job_position_type' => $upload->job_position_type ?: $upload->job?->job_position,
            'jobPositionType' => $upload->job_position_type ?: $upload->job?->job_position,
            'job_position' => $upload->job_position_type ?: $upload->job?->job_position,
            'jobPosition' => $upload->job_position_type ?: $upload->job?->job_position,
            'name' => $upload->name,
            'email' => $upload->email,
            'phone' => $upload->phone,
            'applied_job_title' => $upload->applied_job_title,
            'appliedJobTitle' => $upload->applied_job_title,
            'original_name' => $upload->original_name,
            'saved_name' => $upload->saved_name,
            'mimeType' => $upload->mime_type,
            'mime_type' => $upload->mime_type,
            'classification' => $classification,
            'match_score' => $upload->match_score,
            'overall_score' => $upload->match_score,
            'overallScore' => $upload->match_score,
            'project_score' => $upload->project_score,
            'training_match_score' => $scoreBreakdown['training'] ?? $upload->project_score,
            'trainingMatchScore' => $scoreBreakdown['training'] ?? $upload->project_score,
            'skills_match_score' => $displaySkillsScore,
            'skillsMatchScore' => $displaySkillsScore,
            'education_match_score' => $upload->education_match_score ?? ($scoreBreakdown['education'] ?? null),
            'educationMatchScore' => $upload->education_match_score ?? ($scoreBreakdown['education'] ?? null),
            'experience_match_score' => $upload->experience_match_score ?? ($scoreBreakdown['experience'] ?? null),
            'experienceMatchScore' => $upload->experience_match_score ?? ($scoreBreakdown['experience'] ?? null),
            'eligibility_match_score' => $scoreBreakdown['eligibility'] ?? null,
            'eligibilityMatchScore' => $scoreBreakdown['eligibility'] ?? null,
            'matched_job_title' => $upload->matched_job_title,
            'matchedSkills' => $matchedSkills,
            'matched_skills' => $matchedSkills,
            'matchedTraining' => $matchedTraining,
            'matched_training' => $matchedTraining,
            'missingSkills' => $missingSkills,
            'missing_skills' => $missingSkills,
            'missingTraining' => $missingTraining,
            'missing_training' => $missingTraining,
            'education_text' => $upload->education_text,
            'education_json' => array_values(array_filter(array_map(
                'trim',
                preg_split("/\n+/", (string) ($upload->education_text ?? '')) ?: []
            ))),
            'experience_text' => $upload->experience_text,
            'eligibility_lines' => $eligibilityLines,
            'eligibilityLines' => $eligibilityLines,
            'eligibility_files' => $serializedEligibilityFiles,
            'eligibilityFiles' => $serializedEligibilityFiles,
            'extracted_text' => $upload->extracted_text,
            'summary_text' => $upload->summary_text,
            'resume_summary' => $resumeSummary,
            'pds_format' => $pdsFormat,
            'experience_json' => $upload->experience_json,
            'job_seeker_hidden' => $upload->job_seeker_hidden,
            'job_seeker_hidden_at' => $upload->job_seeker_hidden_at,
            'evaluation_status' => $evaluationStatus,
            'evaluationStatus' => $evaluationStatus,
            'application_status' => $evaluationStatus,
            'applicationStatus' => $evaluationStatus,
            'evaluation_started_at' => $upload->evaluation_started_at?->toISOString(),
            'evaluationStartedAt' => $upload->evaluation_started_at?->toISOString(),
            'ratings' => $this->serializeRatings($upload),
            'rating_count' => $ratingStats['count'],
            'ratingCount' => $ratingStats['count'],
            'average_rating_score' => $ratingStats['average'],
            'averageRatingScore' => $ratingStats['average'],
            'rating_label' => $ratingStats['label'],
            'ratingLabel' => $ratingStats['label'],
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

    private function pdsFormatForUpload(Upload $upload, array $resumeSummary): ?array
    {
        $existing = $resumeSummary['pds'] ?? null;
        $text = trim((string) ($upload->extracted_text ?? ''));
        if ($text === '') {
            return is_array($existing) ? $existing : null;
        }

        $format = $this->pdsExtractionService->format($text);
        if (($format['detected'] ?? false) === true) {
            return $format;
        }

        return is_array($existing) ? $existing : null;
    }

    private function serializeRatings(Upload $upload): array
    {
        $ratings = $upload->relationLoaded('ratings')
            ? $upload->ratings
            : $upload->ratings()->orderByDesc('id')->get();

        return $ratings->map(fn (ApplicationRating $rating) => [
            'id' => $rating->id,
            'rater_name' => $rating->rater_name,
            'raterName' => $rating->rater_name,
            'rater_email' => $rating->rater_email,
            'raterEmail' => $rating->rater_email,
            'form_type' => $this->ratingFormType($rating),
            'formType' => $this->ratingFormType($rating),
            'scores' => $rating->scores ?? [],
            'remarks' => $rating->remarks,
            'total_score' => $rating->total_score,
            'totalScore' => $rating->total_score,
            'percentage_score' => $rating->percentage_score,
            'percentageScore' => $rating->percentage_score,
            'created_at' => $rating->created_at?->toISOString(),
            'createdAt' => $rating->created_at?->toISOString(),
        ])->values()->all();
    }

    private function hasMinimumBoardMemberRatings(Upload $upload): bool
    {
        $ratings = $upload->relationLoaded('ratings')
            ? $upload->ratings
            : $upload->ratings()->get();

        return $ratings
            ->map(fn (ApplicationRating $rating) => $this->normalizeBoardMemberName($rating->rater_name))
            ->filter()
            ->unique()
            ->count() >= self::MINIMUM_RATED_BOARD_MEMBER_COUNT;
    }

    private function applicationStatus(Upload $upload): string
    {
        if ((bool) $upload->job_seeker_hidden) {
            return 'cancelled';
        }

        $status = Str::lower(trim((string) ($upload->evaluation_status ?? '')));

        return match ($status) {
            'for_evaluation' => 'interview',
            'rated' => 'hired',
            'reviewed', 'shortlisted', 'interview', 'rejected', 'hired', 'cancelled' => $status,
            default => 'pending',
        };
    }

    private function hasCompletedAllBoardMemberRatings(Upload $upload, array $boardMembers): bool
    {
        $requiredMembers = collect($boardMembers)
            ->map(fn ($member) => $this->normalizeBoardMemberName((string) $member))
            ->filter()
            ->unique()
            ->values();

        if ($requiredMembers->isEmpty()) {
            return false;
        }

        $ratings = $upload->relationLoaded('ratings')
            ? $upload->ratings
            : $upload->ratings()->get();

        return $requiredMembers->every(function (string $member) use ($ratings): bool {
            $hasInterview = $ratings->contains(function (ApplicationRating $rating) use ($member): bool {
                return $this->normalizeBoardMemberName($rating->rater_name) === $member
                    && $this->ratingFormType($rating) === 'interview';
            });
            $hasDemonstration = $ratings->contains(function (ApplicationRating $rating) use ($member): bool {
                return $this->normalizeBoardMemberName($rating->rater_name) === $member
                    && $this->ratingFormType($rating) === 'demonstration';
            });

            return $hasInterview && $hasDemonstration;
        });
    }

    private function excelCell(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function excelSignatureBlock(): string
    {
        return '<br><table class="signature-wrap">'
            . '<colgroup><col style="width:55%"><col style="width:45%"></colgroup>'
            . '<tr><td>&nbsp;</td><td class="signature-line">&nbsp;</td></tr>'
            . '<tr><td>&nbsp;</td><td class="signature-caption">Signature over Printed Name</td></tr>'
            . '</table>';
    }

    private function excelTextFormula(mixed $value): string
    {
        $text = str_replace('"', '""', (string) $value);
        return $this->excelCell('="' . $text . '"');
    }

    private function formatPhoneForExcel(mixed $phone): string
    {
        $phone = trim((string) $phone);
        if ($phone === '') {
            return '-';
        }

        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (!str_starts_with($phone, '+') && preg_match('/^63\d{10}$/', $digits)) {
            return '+' . $digits;
        }
        if (!str_starts_with($phone, '+') && preg_match('/^9\d{9}$/', $digits)) {
            return '+63' . $digits;
        }

        return $phone;
    }

    private function normalizeBoardMemberName(?string $name): string
    {
        return Str::of((string) $name)
            ->lower()
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();
    }

    private function ratingFormType(ApplicationRating $rating): string
    {
        $remarks = Str::lower((string) ($rating->remarks ?? ''));
        $scoreKeys = array_keys($rating->scores ?? []);

        if (str_contains($remarks, 'applicant demonstration form')) {
            return 'demonstration';
        }

        foreach ($scoreKeys as $key) {
            if (str_contains((string) $key, ': ')) {
                return 'demonstration';
            }
        }

        return 'interview';
    }

    private function ratingsForFormType(Upload $upload, string $formType): \Illuminate\Support\Collection
    {
        $ratings = $upload->relationLoaded('ratings')
            ? $upload->ratings
            : $upload->ratings()->orderBy('id')->get();

        return $ratings
            ->filter(fn (ApplicationRating $rating) => $this->ratingFormType($rating) === $formType)
            ->values();
    }

    private function demonstrationCriterionLabel(string $criterion): string
    {
        $parts = explode(': ', $criterion, 2);
        if (count($parts) < 2) {
            return $criterion;
        }

        return Str::headline($parts[0]) . ' - ' . $parts[1];
    }

    private function userRatingRemarks(ApplicationRating $rating): string
    {
        $remarks = trim((string) ($rating->remarks ?? ''));
        if ($remarks === '') {
            return '-';
        }

        $generatedPrefixes = [
            'applicant demonstration form',
            'board type:',
            'teacher:',
            'subject:',
            'building:',
            'matterlesson:',
            'matter lesson:',
            'date:',
            'time:',
            'room:',
            'mean:',
            'descriptive rating:',
            'observer:',
        ];

        $lines = preg_split('/\R+/', $remarks) ?: [];
        $userLines = array_filter(array_map('trim', $lines), function (string $line) use ($generatedPrefixes): bool {
            $lowerLine = Str::lower($line);

            foreach ($generatedPrefixes as $prefix) {
                if ($lowerLine === $prefix || str_starts_with($lowerLine, $prefix)) {
                    return false;
                }
            }

            return $line !== '';
        });

        $cleaned = trim(implode("\n", $userLines));
        return $cleaned !== '' ? $cleaned : '-';
    }

    private function ratingStats(Upload $upload, ?string $formType = null): array
    {
        $ratings = $upload->relationLoaded('ratings')
            ? $upload->ratings
            : $upload->ratings()->get();

        if ($formType !== null) {
            $ratings = $ratings
                ->filter(fn (ApplicationRating $rating) => $this->ratingFormType($rating) === $formType)
                ->values();
        }

        $count = $ratings->count();
        if ($count === 0) {
            return [
                'count' => 0,
                'average' => null,
                'label' => 'No rating',
            ];
        }

        $average = round((float) $ratings->avg('percentage_score'), 2);
        return [
            'count' => $count,
            'average' => $average,
            'label' => "{$average}%",
        ];
    }

    private function extractedEligibilityLines(Upload $upload, array $resumeSummary): array
    {
        $summaryEligibility = $resumeSummary['eligibility'] ?? $resumeSummary['eligibility_lines'] ?? [];
        if (is_array($summaryEligibility)) {
            $lines = array_values(array_filter(array_map(
                fn ($line) => trim((string) $line),
                $summaryEligibility
            )));
            if ($lines) {
                return $lines;
            }
        }

        $text = str_replace(["\r", "\t"], ["\n", ' '], (string) ($upload->extracted_text ?? ''));
        if (trim($text) === '') {
            return [];
        }

        $block = $text;
        if (preg_match('/\bcivil service eligibility\b\s*(.*?)(?=\b(?:work experience|voluntary work|learning and development|training programs|special skills|other information|references)\b|$)/isu', $text, $match)) {
            $block = (string) ($match[1] ?? '');
        }

        $lines = array_values(array_filter(array_map(
            fn ($line) => trim((string) preg_replace('/\s+/u', ' ', (string) $line)),
            preg_split("/\n+/", $block) ?: []
        )));

        $results = [];
        foreach ($lines as $line) {
            $line = preg_replace('/\b(?:career service|civil service eligibility|rating|date of examination|place of examination|license number|date of validity)\b\s*:?\s*/i', ' ', $line);
            $line = trim((string) preg_replace('/\s+/u', ' ', (string) $line), " \t\n\r\0\x0B:-|");
            if ($line === '' || mb_strlen($line) < 4) {
                continue;
            }
            if (!preg_match('/\b(?:career service|civil service|professional|subprofessional|sub professional|ra\s*1080|board|bar|licensed|licensure|eligibility|csp|cssp|teacher|nurse|engineer|accountant|let|blept)\b/i', $line)) {
                continue;
            }
            $results[] = Str::limit($line, 220, '');
            if (count($results) >= 6) {
                break;
            }
        }

        return array_values(array_unique($results));
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
            'extracted_text' => $file->extracted_text,
            'size_bytes' => $file->size_bytes,
            'uploaded_at' => $file->uploaded_at,
            'download_url' => url("/api/uploads/{$routeUploadId}/supporting/{$file->id}/download"),
        ];
    }

    private function serializeJobSeekerSupportingFile(SupportingFile $file): array
    {
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
            'extracted_text' => $file->extracted_text,
            'size_bytes' => $file->size_bytes,
            'uploaded_at' => $file->uploaded_at,
            'download_url' => url("/api/job-seekers/{$file->job_seeker_id}/supporting/{$file->id}/download"),
        ];
    }

    private function extractSupportingTextFromRequest(Request $request): string
    {
        $supportingFiles = $request->file('supportingFiles', []);
        if (!is_array($supportingFiles)) {
            $supportingFiles = [$supportingFiles];
        }

        $texts = [];
        foreach ($supportingFiles as $supportingFile) {
            if (!$supportingFile instanceof UploadedFile) {
                continue;
            }

            try {
                $text = $this->textExtractionService->extract(
                    $supportingFile->getRealPath(),
                    $supportingFile->getClientMimeType() ?: $supportingFile->getMimeType()
                );
            } catch (\RuntimeException $exception) {
                $text = '';
            }

            if (trim($text) !== '') {
                $texts[] = $text;
            }
        }

        return trim(implode("\n", $texts));
    }

    private function extractExistingSupportingText(Upload $upload): string
    {
        $files = $upload->relationLoaded('supportingFiles')
            ? $upload->supportingFiles
            : $upload->supportingFiles()->get();

        $texts = [];
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

    private function extractExistingSupportingTextForJobSeeker(int $jobSeekerId): string
    {
        $files = SupportingFile::query()
            ->where('job_seeker_id', $jobSeekerId)
            ->orderByDesc('id')
            ->get();

        $texts = [];
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
}
