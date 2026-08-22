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
use App\Services\PdsExtractionService;
use App\Services\ResumeAnalysisService;
use App\Services\TextExtractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    private const APPLICATION_MATCH_BONUS_PERCENT = 10;
    private const APPLICATION_MINIMUM_MATCH_SCORE = 50;

    private const BOARD_MEMBERS = [
        'Dr. Solomon Faller Jr.',
        'Jasmin Graeles',
        'Prof. Drake Ortega Jr.',
        'Josisor Conchada',
        'Prof. Jose Ismael Galamia',
        'Dr. Joyce Magtolis',
        'Cesar Blanco',
    ];

    public function __construct(
        private readonly ResumeAnalysisService $resumeAnalysisService,
        private readonly PdsExtractionService $pdsExtractionService,
        private readonly TextExtractionService $textExtractionService
    ) {
    }

    public function index(): JsonResponse
    {
        $uploads = Upload::query()
            ->with(['supportingFiles', 'ratings', 'jobSeeker', 'job'])
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
            'jobId' => ['nullable', 'integer', 'exists:jobs,id'],
            'supportingTypes' => ['nullable'],
            'supportingFiles' => ['nullable'],
            'jobSeekerId' => ['nullable', 'integer'],
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

        $stored = $this->storeFile($file, 'uploads/resumes');
        $supportingText = $this->extractSupportingTextFromRequest($request);
        try {
            $analysis = $this->resumeAnalysisService->analyzeFile(
                Storage::disk('local')->path($stored['path']),
                $stored['mime_type'],
                (string) ($data['appliedJobTitle'] ?? ''),
                $supportingText,
                $appliedJob?->id
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
                'summary_text' => '',
                'resume_summary' => [],
            ];
        }

        $effectiveMatchScore = min(100, (float) ($analysis['overall_score'] ?? 0) + self::APPLICATION_MATCH_BONUS_PERCENT);
        $minimumMatchScore = (float) ($analysis['application_minimum_score'] ?? self::APPLICATION_MINIMUM_MATCH_SCORE);
        $allowApplication = ($analysis['allow_application'] ?? false) === true;
        if ($appliedJobTitle !== '' && !$allowApplication && $effectiveMatchScore < $minimumMatchScore) {
            Storage::disk('local')->delete($stored['path']);
            return response()->json([
                'message' => 'Your resume does not match this job enough to apply.',
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

        if ($appliedJob?->id || $appliedJobTitle !== '') {
            $alreadyApplied = Upload::query()
                ->where('job_seeker_id', $jobSeeker->id)
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
            'classification' => $analysis['classification'],
            'match_score' => $analysis['overall_score'],
            'project_score' => $analysis['project_score'] ?? $analysis['skills_match_score'] ?? 0,
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

        return response()->json($this->serializeUpload($upload->fresh(['supportingFiles', 'jobSeeker', 'job'])), 201);
    }

    public function show(int $id): JsonResponse
    {
        $upload = Upload::query()->with(['supportingFiles', 'ratings', 'jobSeeker', 'job'])->findOrFail($id);
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
                $this->extractExistingSupportingText($upload),
                $upload->job_id
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
                'summary_text' => '',
                'resume_summary' => [],
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
            'summary_text' => $analysis['summary_text'] ?? '',
            'resume_summary' => $analysis['resume_summary'] ?? [],
            'experience_json' => array_values(array_filter(array_map(
                'trim',
                preg_split("/\n+/", (string) ($analysis['experience_text'] ?? '')) ?: []
            ))),
        ])->save();

        return response()->json($this->serializeUpload($upload->fresh(['supportingFiles', 'jobSeeker', 'job'])));
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

    public function exportRatingSummary(Request $request, int $id): mixed
    {
        $upload = Upload::query()->with(['ratings', 'jobSeeker'])->findOrFail($id);
        if (Str::lower((string) $upload->evaluation_status) !== 'rated') {
            return response()->json([
                'message' => 'Rating summary can only be exported after the application is rated.',
            ], 422);
        }

        $stats = $this->ratingStats($upload);
        $phone = $this->formatPhoneForExcel($upload->phone);
        $rows = [
            ['Applicant Name', $upload->name ?: '-'],
            ['Unique ID', $upload->job_seeker_id_number ?: $upload->jobSeeker?->id_number ?: '-'],
            ['Email', $upload->email ?: '-'],
            ['Phone', $phone, true],
            ['Position Applied', $upload->applied_job_title ?: $upload->matched_job_title ?: '-'],
            ['Date of Interview', $upload->uploaded_at?->format('F j, Y') ?: '-'],
            ['Application Status', 'Rated'],
            ['Classification', $upload->classification ?: '-'],
            ['Match Score', $upload->match_score !== null ? round((float) $upload->match_score, 2) . '%' : '-'],
            ['Average Rating', $stats['average'] !== null ? $stats['average'] . '%' : '-'],
            ['Rating Count', $stats['count']],
        ];

        $ratings = $upload->ratings()->orderBy('id')->get();
        $criteria = $ratings
            ->flatMap(fn (ApplicationRating $rating) => array_keys($rating->scores ?? []))
            ->unique()
            ->values();
        $ratingColumnSpan = 5 + $criteria->count();

        $html = '<html><head><meta charset="UTF-8">';
        $html .= '<style>
            body { font-family: Arial, sans-serif; color: #172033; }
            table { border-collapse: collapse; margin: 0; }
            th, td { border: 1px solid #b8c4d8; padding: 8px 10px; vertical-align: middle; text-align: center; }
            .title { background: #0f2f82; color: #ffffff; font-size: 20px; font-weight: 700; }
            .subtitle { background: #eaf0ff; color: #172033; font-size: 12px; }
            .section { background: #163d9b; color: #ffffff; font-weight: 700; font-size: 15px; }
            .label { background: #f3f6fb; color: #172033; font-weight: 700; width: 210px; }
            .value { width: 390px; mso-number-format:"\@"; }
            .head { background: #dbe6ff; color: #10245a; font-weight: 700; }
            .center { text-align: center; }
            .text { mso-number-format:"\@"; }
            .muted { color: #64748b; }
        </style>';
        $html .= '</head><body>';
        $html .= '<table>';
        $html .= '<colgroup><col style="width:210px"><col style="width:390px"></colgroup>';
        $html .= '<tr><th class="title" colspan="2">Application Rating Summary</th></tr>';
        $html .= '<tr><td class="subtitle" colspan="2">Generated on ' . $this->excelCell(now()->format('F j, Y g:i A')) . '</td></tr>';
        $html .= '<tr><th class="section" colspan="2">Applicant Information</th></tr>';
        foreach ($rows as $row) {
            $value = ($row[2] ?? false) ? $this->excelTextFormula($row[1]) : $this->excelCell($row[1]);
            $html .= '<tr><th class="label">' . $this->excelCell($row[0]) . '</th><td class="value text">' . $value . '</td></tr>';
        }
        $html .= '</table><br>';
        $html .= '<table>';
        $html .= '<tr><th class="section" colspan="' . $ratingColumnSpan . '">Board Member Ratings</th></tr>';
        $html .= '<tr>';
        $html .= '<th class="head">Board Member</th><th class="head">Date Rated</th><th class="head">Total Score</th><th class="head">Percentage</th>';
        foreach ($criteria as $criterion) {
            $html .= '<th class="head">' . $this->excelCell($criterion) . '</th>';
        }
        $html .= '<th class="head">Remarks</th>';
        $html .= '</tr>';
        foreach ($ratings as $rating) {
            $scores = collect($rating->scores ?? []);
            $possibleScore = max(1, $scores->count()) * 5;
            $html .= '<tr>';
            $html .= '<td class="text">' . $this->excelCell($rating->rater_name ?: 'Board member') . '</td>';
            $html .= '<td class="text">' . $this->excelCell($rating->created_at?->format('F j, Y g:i A') ?: '-') . '</td>';
            $html .= '<td class="text">' . $this->excelCell($rating->total_score . '/' . $possibleScore) . '</td>';
            $html .= '<td class="text">' . $this->excelCell(round((float) $rating->percentage_score, 2) . '%') . '</td>';
            foreach ($criteria as $criterion) {
                $html .= '<td class="text">' . $this->excelCell($scores->get($criterion, '-')) . '</td>';
            }
            $html .= '<td class="text">' . $this->excelCell($rating->remarks ?: '-') . '</td>';
            $html .= '</tr>';
        }
        $html .= '<tr>';
        $html .= '<th class="label">Average</th><td class="muted" colspan="2">All board members</td>';
        $html .= '<td class="text"><strong>' . $this->excelCell($stats['average'] !== null ? $stats['average'] . '%' : '-') . '</strong></td>';
        if ($criteria->count() > 0) {
            $html .= '<td class="muted" colspan="' . $criteria->count() . '"></td>';
        }
        $html .= '<td class="muted"></td>';
        $html .= '</tr>';
        $html .= '</table></body></html>';

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

    public function markForEvaluation(Request $request, int $id): JsonResponse
    {
        $upload = Upload::findOrFail($id);
        $upload->evaluation_status = 'for_evaluation';
        $upload->evaluation_started_at = now();
        $upload->save();

        ActivityLog::record('application.interviewed', "Moved {$upload->name} to interview evaluation.", $request, [
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
            'scores' => ['required', 'array'],
            'scores.*' => ['required', 'integer', 'min:1', 'max:5'],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        $scores = array_map('intval', $data['scores']);
        $totalScore = array_sum($scores);
        $percentageScore = round(($totalScore / 50) * 100, 2);
        $raterName = trim((string) ($data['raterName'] ?? ''));
        $raterEmail = Str::lower(trim((string) ($data['raterEmail'] ?? '')));

        $alreadyRated = ApplicationRating::query()
            ->where('upload_id', $upload->id)
            ->where(function ($query) use ($raterEmail, $raterName) {
                if ($raterEmail !== '') {
                    $query->whereRaw('LOWER(rater_email) = ?', [$raterEmail]);
                    return;
                }

                $query->whereRaw('LOWER(rater_name) = ?', [Str::lower($raterName)]);
            })
            ->exists();

        if ($alreadyRated) {
            return response()->json([
                'message' => 'This board member has already rated this applicant.',
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
        $boardMembers = $this->cleanBoardMembers($data['boardMembers'] ?? []);
        $upload->evaluation_status = $this->allBoardMembersRated($upload, $boardMembers) ? 'rated' : 'for_evaluation';
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
        $upload->evaluation_status = null;
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
        $resumeSummary = $upload->resume_summary ?? [];
        $pdsFormat = $this->pdsFormatForUpload($upload, $resumeSummary);
        if ($pdsFormat !== null) {
            $resumeSummary['pds'] = $pdsFormat;
        }

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
            'summary_text' => $upload->summary_text,
            'resume_summary' => $resumeSummary,
            'pds_format' => $pdsFormat,
            'experience_json' => $upload->experience_json,
            'job_seeker_hidden' => $upload->job_seeker_hidden,
            'job_seeker_hidden_at' => $upload->job_seeker_hidden_at,
            'evaluation_status' => $upload->evaluation_status,
            'evaluationStatus' => $upload->evaluation_status,
            'evaluation_started_at' => $upload->evaluation_started_at?->toISOString(),
            'evaluationStartedAt' => $upload->evaluation_started_at?->toISOString(),
            'ratings' => $this->serializeRatings($upload),
            'rating_count' => $this->ratingStats($upload)['count'],
            'ratingCount' => $this->ratingStats($upload)['count'],
            'average_rating_score' => $this->ratingStats($upload)['average'],
            'averageRatingScore' => $this->ratingStats($upload)['average'],
            'rating_label' => $this->ratingStats($upload)['label'],
            'ratingLabel' => $this->ratingStats($upload)['label'],
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

    private function allBoardMembersRated(Upload $upload, array $boardMembers = []): bool
    {
        $requiredBoardMembers = count($boardMembers) > 0 ? $boardMembers : self::BOARD_MEMBERS;
        $ratings = $upload->relationLoaded('ratings')
            ? $upload->ratings
            : $upload->ratings()->get();

        $ratedNames = $ratings
            ->map(fn (ApplicationRating $rating) => $this->normalizeBoardMemberName($rating->rater_name))
            ->filter()
            ->unique()
            ->values();

        return collect($requiredBoardMembers)
            ->map(fn (string $name) => $this->normalizeBoardMemberName($name))
            ->every(fn (string $name) => $ratedNames->contains($name));
    }

    private function cleanBoardMembers(array $boardMembers): array
    {
        return collect($boardMembers)
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->unique(fn (string $name) => Str::lower($name))
            ->values()
            ->all();
    }

    private function excelCell(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
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

    private function ratingStats(Upload $upload): array
    {
        $ratings = $upload->relationLoaded('ratings')
            ? $upload->ratings
            : $upload->ratings()->get();

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
}
