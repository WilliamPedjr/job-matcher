<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Archive;
use App\Models\ApplicationRating;
use App\Models\Upload;
use App\Models\Employer;
use App\Models\GlobalSkillCatalog;
use App\Models\Job;
use App\Models\JobSeeker;
use App\Models\JobSkillCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class ArchiveController extends Controller
{
    public function index(): JsonResponse
    {
        $archives = Archive::query()
            ->orderByDesc('deleted_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Archive $archive) => [
                'id' => $archive->id,
                'record_type' => $archive->record_type,
                'recordType' => $archive->record_type,
                'record_id' => $archive->record_id,
                'recordId' => $archive->record_id,
                'title' => $archive->title,
                'subtitle' => $archive->subtitle,
                'data' => $this->sanitizeArchiveData($archive->data ?? []),
                'requires_password' => $archive->record_type === 'personnel' && empty($archive->data['password']),
                'actor_name' => $archive->actor_name,
                'actorName' => $archive->actor_name,
                'actor_email' => $archive->actor_email,
                'actorEmail' => $archive->actor_email,
                'actor_role' => $archive->actor_role,
                'actorRole' => $archive->actor_role,
                'deleted_at' => $archive->deleted_at?->toISOString(),
                'deletedAt' => $archive->deleted_at?->toISOString(),
                'created_at' => $archive->created_at?->toISOString(),
                'createdAt' => $archive->created_at?->toISOString(),
            ]);

        return response()->json($archives);
    }

    public function restoreJob(Request $request, int $id): JsonResponse
    {
        $archive = Archive::findOrFail($id);
        if ($archive->record_type !== 'job') {
            return response()->json([
                'message' => 'Only archived job records can be restored here.',
            ], 422);
        }

        $data = $archive->data ?? [];
        $job = Job::create([
            'template_id' => $data['template_id'] ?? $data['templateId'] ?? null,
            'source' => $data['source'] ?? 'restored',
            'title' => $data['title'] ?? $archive->title ?? 'Restored Job',
            'description' => $data['description'] ?? '',
            'status' => $data['status'] ?? 'active',
            'department' => $data['department'] ?? null,
            'job_position' => $data['job_position'] ?? $data['jobPosition'] ?? null,
            'item_no' => $data['item_no'] ?? $data['itemNo'] ?? null,
            'location' => $data['location'] ?? null,
            'type' => $data['type'] ?? null,
            'deadline' => $data['deadline'] ?? null,
            'eligibility' => $data['eligibility'] ?? null,
            'required_skills' => $data['required_skills'] ?? $data['requiredSkills'] ?? '',
            'minimum_education' => $data['minimum_education'] ?? $data['minimumEducation'] ?? '',
            'minimum_experience_years' => (int) ($data['minimum_experience_years'] ?? $data['minimumExperienceYears'] ?? 0),
            'salary_min' => $data['salary_min'] ?? $data['salaryMin'] ?? null,
            'salary_max' => $data['salary_max'] ?? $data['salaryMax'] ?? null,
        ]);

        foreach ($this->parseSkills($data['skills'] ?? $data['required_skills'] ?? $data['requiredSkills'] ?? '') as $skill) {
            JobSkillCatalog::query()->firstOrCreate([
                'job_id' => $job->id,
                'skill' => $skill,
            ]);
            GlobalSkillCatalog::query()->firstOrCreate(['skill' => $skill]);
        }

        $archive->delete();

        ActivityLog::record('job.restored', "Restored archived job {$job->title}.", $request, [
            'subject_type' => 'job',
            'subject_id' => $job->id,
            'subject_name' => $job->title,
            'metadata' => [
                'archiveId' => $id,
                'status' => $job->status,
            ],
        ]);

        return response()->json([
            'message' => 'Job restored successfully.',
            'job' => [
                'id' => $job->id,
                'title' => $job->title,
                'status' => $job->status,
            ],
        ]);
    }

    public function restoreJobSeeker(Request $request, int $id): JsonResponse
    {
        $archive = Archive::findOrFail($id);
        if ($archive->record_type !== 'job_seeker') {
            return response()->json([
                'message' => 'Only archived job seeker records can be restored here.',
            ], 422);
        }

        $data = $archive->data ?? [];
        $email = Str::lower(trim((string) ($data['email'] ?? $archive->subtitle ?? '')));
        $username = trim((string) ($data['username'] ?? ''));
        $idNumber = trim((string) ($data['id_number'] ?? $data['idNumber'] ?? ''));

        if ($email === '') {
            return response()->json(['message' => 'Archived job seeker has no email address to restore.'], 422);
        }

        if (JobSeeker::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            return response()->json(['message' => 'A job seeker with this email already exists.'], 422);
        }

        if ($username !== '' && JobSeeker::query()->whereRaw('LOWER(username) = ?', [Str::lower($username)])->exists()) {
            return response()->json(['message' => 'A job seeker with this username already exists.'], 422);
        }

        if ($idNumber !== '' && JobSeeker::query()->whereRaw('LOWER(id_number) = ?', [Str::lower($idNumber)])->exists()) {
            return response()->json(['message' => 'A job seeker with this ID number already exists.'], 422);
        }

        $hadStoredPassword = !empty($data['password']);
        $jobSeeker = JobSeeker::create([
            'full_name' => $data['full_name'] ?? $data['fullName'] ?? $archive->title ?? 'Restored Job Seeker',
            'email' => $email,
            'username' => $username !== '' ? $username : null,
            'phone' => $data['phone'] ?? null,
            'status' => $data['status'] ?? 'active',
            'address' => $data['address'] ?? null,
            'about_text' => $data['about_text'] ?? $data['aboutText'] ?? null,
            'manual_skills' => $data['manual_skills'] ?? [],
            'profile_photo_path' => $data['profile_photo_path'] ?? null,
            'linked_in_url' => $data['linkedInUrl'] ?? $data['linked_in_url'] ?? null,
            'password' => $data['password'] ?? Hash::make(Str::random(40)),
        ]);

        $jobSeeker->forceFill([
            'id_number' => $idNumber !== '' ? $idNumber : $this->formatJobSeekerIdNumber($jobSeeker->id),
            'email_verified_at' => $data['email_verified_at'] ?? $data['emailVerifiedAt'] ?? now(),
            'email_verification_token' => null,
            'email_verification_sent_at' => null,
        ])->save();

        $archive->delete();

        ActivityLog::record('job_seeker.restored', "Restored archived job seeker {$jobSeeker->full_name}.", $request, [
            'subject_type' => 'job_seeker',
            'subject_id' => $jobSeeker->id,
            'subject_name' => $jobSeeker->full_name,
            'metadata' => [
                'archiveId' => $id,
                'email' => $jobSeeker->email,
            ],
        ]);

        return response()->json([
            'message' => $hadStoredPassword
                ? 'Job seeker restored successfully.'
                : 'Job seeker restored successfully. Ask the user to reset their password before logging in.',
            'jobSeeker' => [
                'id' => $jobSeeker->id,
                'fullName' => $jobSeeker->full_name,
                'email' => $jobSeeker->email,
            ],
        ]);
    }

    public function restorePersonnel(Request $request, int $id): JsonResponse
    {
        $staff = Auth::guard('web')->user();
        $personnel = Auth::guard('employer')->user();
        abort_unless($staff || $personnel || Auth::guard('job_seeker')->check(), 401, 'Please sign in to continue.');
        $allowed = $staff && !in_array(Str::lower((string) $staff->role), ['board', 'jobseeker'], true);
        if ($personnel && Str::lower((string) $personnel->position_type) !== 'board') {
            $access = $personnel->page_access;
            $allowed = !$access || (in_array('users', $access, true) && in_array('archive', $access, true));
        }
        abort_unless($allowed, 403, 'You need permission to manage personnel accounts and archives.');

        return DB::transaction(function () use ($request, $id) {
            $archive = Archive::query()->lockForUpdate()->findOrFail($id);
            abort_unless($archive->record_type === 'personnel', 422, 'Only archived personnel accounts can be restored here.');
            $data = $archive->data ?? [];
            $email = Str::lower(trim((string) ($data['email'] ?? $archive->subtitle ?? '')));
            $username = trim((string) ($data['username'] ?? ''));
            $idNumber = trim((string) ($data['id_number'] ?? $data['idNumber'] ?? ''));
            abort_if($email === '', 422, 'Archived personnel account has no email address to restore.');
            foreach (['email' => $email, 'username' => $username, 'id_number' => $idNumber] as $field => $value) {
                if ($value !== '' && Employer::query()->whereRaw('LOWER('.$field.') = ?', [Str::lower($value)])->exists()) {
                    $label = $field === 'id_number' ? 'ID number' : $field;
                    abort(422, "A personnel account with this {$label} already exists.");
                }
            }
            $validated = $request->validate([
                'password' => [empty($data['password']) ? 'required' : 'nullable', 'string', 'min:8', 'max:72'],
            ]);
            $personnel = Employer::create([
                'company_name' => $data['company_name'] ?? $data['companyName'] ?? $archive->title,
                'full_name' => $data['full_name'] ?? $data['fullName'] ?? $data['contactName'] ?? null,
                'email' => $email, 'username' => $username !== '' ? $username : null,
                'id_number' => $idNumber !== '' ? $idNumber : null, 'phone' => $data['phone'] ?? null,
                'position_type' => $data['position_type'] ?? $data['positionType'] ?? 'personnel',
                'page_access' => $data['page_access'] ?? $data['pageAccess'] ?? null,
                'password' => !empty($validated['password']) ? Hash::make($validated['password']) : $data['password'],
            ]);
            $archive->delete();
            ActivityLog::record('personnel.restored', "Restored archived personnel account {$personnel->company_name}.", $request, [
                'subject_type' => 'personnel', 'subject_id' => $personnel->id, 'subject_name' => $personnel->company_name,
                'metadata' => ['archiveId' => $id, 'email' => $personnel->email],
            ]);

            return response()->json([
                'message' => 'Personnel account restored successfully.',
                'personnel' => ['id' => $personnel->id, 'email' => $personnel->email, 'fullName' => $personnel->full_name],
            ]);
        });
    }

    public function restoreRating(Request $request, int $id): JsonResponse
    {
        return DB::transaction(function () use ($request, $id) {
            $archive = Archive::query()->lockForUpdate()->findOrFail($id);
            abort_unless($archive->record_type === 'rating', 422, 'Only archived ratings can be restored here.');
            $upload = Upload::query()->lockForUpdate()->find($archive->record_id);
            abort_unless($upload, 422, 'The original application no longer exists. These ratings cannot be restored.');
            abort_if($upload->ratings()->exists(), 409, 'This application already has ratings. Restore cancelled to protect the current ratings.');
            $data = $archive->data ?? [];
            $ratings = $data['ratings'] ?? [];
            abort_unless(is_array($ratings) && count($ratings) > 0, 422, 'This archive has no saved ratings to restore.');
            foreach ($ratings as $saved) {
                abort_unless(is_array($saved) && is_array($saved['scores'] ?? null), 422, 'The archived rating data is incomplete.');
                $rating = new ApplicationRating([
                    'upload_id' => $upload->id,
                    'rater_name' => $saved['rater_name'] ?? $saved['raterName'] ?? null,
                    'rater_email' => $saved['rater_email'] ?? $saved['raterEmail'] ?? null,
                    'scores' => $saved['scores'],
                    'remarks' => $saved['remarks'] ?? null,
                    'total_score' => $saved['total_score'] ?? $saved['totalScore'] ?? array_sum($saved['scores']),
                    'percentage_score' => $saved['percentage_score'] ?? $saved['percentageScore'] ?? 0,
                ]);
                $rating->created_at = $saved['created_at'] ?? $saved['createdAt'] ?? now();
                $rating->save();
            }
            // Recover the evaluation without assigning a vacancy or hiring the applicant.
            if ($upload->evaluation_status !== 'hired') {
                $upload->evaluation_status = 'rated';
            }
            $upload->evaluation_started_at ??= $data['applicant']['evaluation_started_at']
                ?? $data['applicant']['evaluationStartedAt'] ?? now();
            $upload->save();
            $archive->delete();
            ActivityLog::record('rating.restored', "Restored archived ratings for {$upload->name}.", $request, [
                'subject_type' => 'application', 'subject_id' => $upload->id, 'subject_name' => $upload->name,
                'metadata' => ['archiveId' => $id, 'ratingCount' => count($ratings)],
            ]);

            return response()->json(['message' => 'Ratings restored successfully.', 'applicationId' => $upload->id]);
        });
    }

    private function parseSkills(string|array|null $value): array
    {
        $items = is_array($value)
            ? $value
            : (preg_split('/[,;\n|]+/', (string) $value) ?: []);

        return array_values(array_unique(array_filter(array_map(
            fn ($item) => trim((string) $item),
            $items
        ))));
    }

    private function sanitizeArchiveData(array $data): array
    {
        foreach (['password', 'remember_token', 'email_verification_token'] as $key) {
            unset($data[$key]);
        }

        return $data;
    }

    private function formatJobSeekerIdNumber(int $id): string
    {
        return sprintf('LNU-%06d', $id);
    }
}
