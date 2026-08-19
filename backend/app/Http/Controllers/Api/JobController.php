<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Archive;
use App\Models\GlobalSkillCatalog;
use App\Models\Job;
use App\Models\JobTemplate;
use App\Models\JobSkillCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class JobController extends Controller
{
    public function index(): JsonResponse
    {
        Job::closeExpiredActiveJobs();

        $jobs = Job::query()->orderBy('id')->get()->map(fn (Job $job) => $this->serialize($job));
        return response()->json($jobs);
    }

    public function templates(): JsonResponse
    {
        $templates = JobTemplate::query()
            ->orderBy('id')
            ->get()
            ->map(fn (JobTemplate $template) => $this->serializeTemplate($template));

        return response()->json($templates);
    }

    public function show(int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $job->closeIfDeadlineIsMet();

        return response()->json($this->serialize($job));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateJob($request);
        $job = Job::create($this->normalizeJobPayload($data, 'db'));
        $job->closeIfDeadlineIsMet();
        $this->syncSkills($job->id, $data['required_skills'] ?? '');
        $event = $request->input('activityEvent') === 'job.duplicated' ? 'job.duplicated' : 'job.created';
        $description = $event === 'job.duplicated'
            ? "Duplicated job post {$job->title}."
            : "Posted job {$job->title}.";
        ActivityLog::record($event, $description, $request, [
            'subject_type' => 'job',
            'subject_id' => $job->id,
            'subject_name' => $job->title,
            'metadata' => [
                'status' => $job->status,
                'department' => $job->department,
                'sourceJobId' => $request->input('sourceJobId'),
                'sourceJobTitle' => $request->input('sourceJobTitle'),
            ],
        ]);
        return response()->json($this->serialize($job->fresh()), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $data = $this->validateJob($request, true);
        $job->fill($this->normalizeJobPayload($data, false));
        $job->save();
        $job->closeIfDeadlineIsMet();

        if (array_key_exists('required_skills', $data)) {
            $this->syncSkills($job->id, $data['required_skills'] ?? '');
        }

        ActivityLog::record('job.updated', "Edited job details for {$job->title}.", $request, [
            'subject_type' => 'job',
            'subject_id' => $job->id,
            'subject_name' => $job->title,
            'metadata' => [
                'status' => $job->status,
                'department' => $job->department,
            ],
        ]);

        return response()->json($this->serialize($job->fresh()));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);

        Archive::create([
            'record_type' => 'job',
            'record_id' => $job->id,
            'title' => $job->title,
            'subtitle' => $job->department,
            'data' => $this->serialize($job),
            ...Archive::actorFromRequest($request),
            'deleted_at' => now(),
        ]);

        ActivityLog::record('job.deleted', "Deleted job post {$job->title}.", $request, [
            'subject_type' => 'job',
            'subject_id' => $job->id,
            'subject_name' => $job->title,
            'metadata' => [
                'department' => $job->department,
                'status' => $job->status,
            ],
        ]);

        $job->delete();
        return response()->json(['message' => 'Job deleted successfully.']);
    }

    public function status(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $data = $request->validate([
            'status' => ['required', 'string', 'max:20'],
        ]);

        $previousStatus = $this->normalizeStatus($job->status);
        $job->status = $this->normalizeStatus($data['status'] ?? 'active');
        $job->save();
        $job->closeIfDeadlineIsMet();

        ActivityLog::record('job.status_changed', "Changed {$job->title} status from {$previousStatus} to {$job->status}.", $request, [
            'subject_type' => 'job',
            'subject_id' => $job->id,
            'subject_name' => $job->title,
            'metadata' => [
                'previousStatus' => $previousStatus,
                'newStatus' => $job->status,
            ],
        ]);

        return response()->json($this->serialize($job));
    }

    public function skills(int $id): JsonResponse
    {
        $skills = JobSkillCatalog::query()
            ->where('job_id', $id)
            ->orderBy('skill')
            ->pluck('skill')
            ->values();

        return response()->json([
            'skills' => $skills,
        ]);
    }

    public function updateSkills(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'skills' => ['required'],
        ]);

        $this->syncSkills($id, $data['skills']);

        return response()->json([
            'skills' => JobSkillCatalog::query()
                ->where('job_id', $id)
                ->orderBy('skill')
                ->pluck('skill')
                ->values(),
        ]);
    }

    private function validateJob(Request $request, bool $isUpdate = false): array
    {
        $this->mergeJobAliases($request);

        $rules = [
            'title' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:255'],
            'description' => [$isUpdate ? 'sometimes' : 'required', 'string'],
            'status' => ['nullable', 'string', 'max:20'],
            'department' => ['nullable', 'string', 'max:255'],
            'job_position' => ['nullable', 'string', 'in:Teaching,Non-Teaching'],
            'item_no' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'deadline' => ['nullable', 'date'],
            'eligibility' => ['nullable', 'string', 'max:255'],
            'required_skills' => ['nullable', 'string'],
            'minimum_education' => ['nullable', 'string'],
            'minimum_experience_years' => ['nullable', 'integer', 'min:0'],
            'salary_min' => ['nullable', 'integer', 'min:0'],
            'salary_max' => ['nullable', 'integer', 'min:0'],
        ];

        return $request->validate($rules);
    }

    private function mergeJobAliases(Request $request): void
    {
        $aliases = [
            'itemNo' => 'item_no',
            'jobPosition' => 'job_position',
            'requiredSkills' => 'required_skills',
            'minimumEducation' => 'minimum_education',
            'minimumExperienceYears' => 'minimum_experience_years',
            'salaryMin' => 'salary_min',
            'salaryMax' => 'salary_max',
        ];

        $merged = [];
        foreach ($aliases as $camel => $snake) {
            if (!$request->has($snake) && $request->has($camel)) {
                $merged[$snake] = $request->input($camel);
            }
        }

        if ($merged) {
            $request->merge($merged);
        }
    }

    private function normalizeJobPayload(array $data, bool $mergeDefaults = true): array
    {
        return [
            'title' => $data['title'] ?? '',
            'description' => $data['description'] ?? '',
            'status' => $this->normalizeStatus($data['status'] ?? 'active'),
            'department' => $data['department'] ?? ($mergeDefaults ? 'Information Technology' : null),
            'job_position' => $this->normalizeJobPosition($data['job_position'] ?? null),
            'item_no' => $data['item_no'] ?? null,
            'location' => $data['location'] ?? ($mergeDefaults ? 'Manila, Philippines' : null),
            'type' => $data['type'] ?? ($mergeDefaults ? 'Full-time' : null),
            'deadline' => $data['deadline'] ?? null,
            'eligibility' => $data['eligibility'] ?? null,
            'required_skills' => $data['required_skills'] ?? '',
            'minimum_education' => $data['minimum_education'] ?? '',
            'minimum_experience_years' => (int) ($data['minimum_experience_years'] ?? 0),
            'salary_min' => $data['salary_min'] ?? null,
            'salary_max' => $data['salary_max'] ?? null,
        ];
    }

    private function normalizeStatus(?string $status): string
    {
        $value = Str::lower(trim((string) $status));
        return in_array($value, ['active', 'closed'], true) ? $value : 'active';
    }

    private function normalizeJobPosition(?string $jobPosition): ?string
    {
        $value = Str::lower(trim((string) $jobPosition));
        if ($value === 'teaching') {
            return 'Teaching';
        }
        if ($value === 'non-teaching' || $value === 'non teaching') {
            return 'Non-Teaching';
        }

        return null;
    }

    private function syncSkills(int $jobId, string|array|null $skills): void
    {
        $parsed = $this->parseSkills($skills);
        JobSkillCatalog::query()->where('job_id', $jobId)->delete();

        foreach ($parsed as $skill) {
            JobSkillCatalog::query()->create([
                'job_id' => $jobId,
                'skill' => $skill,
            ]);
        }

        foreach ($parsed as $skill) {
            GlobalSkillCatalog::query()->firstOrCreate(['skill' => $skill]);
        }
    }

    private function parseSkills(string|array|null $value): array
    {
        if (is_array($value)) {
            $items = $value;
        } else {
            $items = preg_split('/[,;\n|]+/', (string) $value) ?: [];
        }

        return array_values(array_unique(array_filter(array_map(
            fn ($item) => trim((string) $item),
            $items
        ))));
    }

    private function serialize(Job $job): array
    {
        $skills = JobSkillCatalog::query()->where('job_id', $job->id)->orderBy('skill')->pluck('skill')->values()->all();
        $requiredSkills = $this->publicRequiredSkills($job->required_skills);

        return [
            'id' => $job->id,
            'template_id' => null,
            'templateId' => null,
            'source' => 'job',
            'title' => $job->title,
            'description' => $job->description,
            'status' => $this->normalizeStatus($job->status),
            'department' => $job->department,
            'job_position' => $job->job_position,
            'jobPosition' => $job->job_position,
            'item_no' => $job->item_no,
            'itemNo' => $job->item_no,
            'location' => $job->location,
            'type' => $job->type,
            'deadline' => optional($job->deadline)->format('Y-m-d') ?? $job->deadline,
            'eligibility' => $job->eligibility,
            'required_skills' => $requiredSkills,
            'requiredSkills' => $requiredSkills,
            'minimum_education' => $job->minimum_education,
            'minimumEducation' => $job->minimum_education,
            'minimum_experience_years' => (int) $job->minimum_experience_years,
            'minimumExperienceYears' => (int) $job->minimum_experience_years,
            'salary_min' => $job->salary_min,
            'salaryMin' => $job->salary_min,
            'salary_max' => $job->salary_max,
            'salaryMax' => $job->salary_max,
            'skills' => $skills,
        ];
    }

    private function serializeTemplate(JobTemplate $template): array
    {
        $requiredSkills = $this->publicRequiredSkills($template->required_skills);

        return [
            'id' => $template->id,
            'template_id' => $template->id,
            'templateId' => $template->id,
            'source' => 'template',
            'title' => $template->title,
            'description' => $template->description,
            'status' => 'active',
            'department' => $template->department,
            'job_position' => $template->job_position,
            'jobPosition' => $template->job_position,
            'item_no' => $template->item_no,
            'itemNo' => $template->item_no,
            'location' => $template->location,
            'type' => $template->type,
            'deadline' => optional($template->deadline)->format('Y-m-d') ?? $template->deadline,
            'eligibility' => $template->eligibility,
            'required_skills' => $requiredSkills,
            'requiredSkills' => $requiredSkills,
            'minimum_education' => $template->minimum_education,
            'minimumEducation' => $template->minimum_education,
            'minimum_experience_years' => (int) $template->minimum_experience_years,
            'minimumExperienceYears' => (int) $template->minimum_experience_years,
            'salary_min' => $template->salary_min,
            'salaryMin' => $template->salary_min,
            'salary_max' => $template->salary_max,
            'salaryMax' => $template->salary_max,
            'skills' => $this->parseSkills($requiredSkills),
        ];
    }

    private function publicRequiredSkills(?string $requiredSkills): ?string
    {
        if (trim((string) $requiredSkills) === '__MATCH_ALL__') {
            return 'Open qualifications';
        }

        if (trim((string) $requiredSkills) === '__MATCH_MODERATE__') {
            return 'Open qualifications with review';
        }

        return $requiredSkills;
    }
}
