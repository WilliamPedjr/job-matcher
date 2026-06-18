<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        return response()->json($this->serialize($job));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateJob($request);
        $job = Job::create($this->normalizeJobPayload($data, 'db'));
        $this->syncSkills($job->id, $data['required_skills'] ?? '');
        return response()->json($this->serialize($job->fresh()), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $data = $this->validateJob($request, true);
        $job->fill($this->normalizeJobPayload($data, false));
        $job->save();

        if (array_key_exists('required_skills', $data)) {
            $this->syncSkills($job->id, $data['required_skills'] ?? '');
        }

        return response()->json($this->serialize($job->fresh()));
    }

    public function destroy(int $id): JsonResponse
    {
        Job::findOrFail($id)->delete();
        return response()->json(['message' => 'Job deleted successfully.']);
    }

    public function status(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $data = $request->validate([
            'status' => ['required', 'string', 'max:20'],
        ]);

        $job->status = Str::lower(trim($data['status'])) === 'closed' ? 'closed' : 'active';
        $job->save();

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
        $rules = [
            'title' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:255'],
            'description' => [$isUpdate ? 'sometimes' : 'required', 'string'],
            'status' => ['nullable', 'string', 'max:20'],
            'department' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'required_skills' => ['nullable', 'string'],
            'minimum_education' => ['nullable', 'string'],
            'minimum_experience_years' => ['nullable', 'integer', 'min:0'],
            'salary_min' => ['nullable', 'integer', 'min:0'],
            'salary_max' => ['nullable', 'integer', 'min:0'],
        ];

        return $request->validate($rules);
    }

    private function normalizeJobPayload(array $data, bool $mergeDefaults = true): array
    {
        return [
            'title' => $data['title'] ?? '',
            'description' => $data['description'] ?? '',
            'status' => isset($data['status']) && Str::lower($data['status']) === 'closed' ? 'closed' : 'active',
            'department' => $data['department'] ?? ($mergeDefaults ? 'Information Technology' : null),
            'location' => $data['location'] ?? ($mergeDefaults ? 'Manila, Philippines' : null),
            'type' => $data['type'] ?? ($mergeDefaults ? 'Full-time' : null),
            'required_skills' => $data['required_skills'] ?? '',
            'minimum_education' => $data['minimum_education'] ?? '',
            'minimum_experience_years' => (int) ($data['minimum_experience_years'] ?? 0),
            'salary_min' => $data['salary_min'] ?? null,
            'salary_max' => $data['salary_max'] ?? null,
        ];
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

        return [
            'id' => $job->id,
            'template_id' => null,
            'templateId' => null,
            'source' => 'job',
            'title' => $job->title,
            'description' => $job->description,
            'status' => $job->status,
            'department' => $job->department,
            'location' => $job->location,
            'type' => $job->type,
            'required_skills' => $job->required_skills,
            'requiredSkills' => $job->required_skills,
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
        return [
            'id' => $template->id,
            'template_id' => $template->id,
            'templateId' => $template->id,
            'source' => 'template',
            'title' => $template->title,
            'description' => $template->description,
            'status' => 'active',
            'department' => $template->department,
            'location' => $template->location,
            'type' => $template->type,
            'required_skills' => $template->required_skills,
            'requiredSkills' => $template->required_skills,
            'minimum_education' => $template->minimum_education,
            'minimumEducation' => $template->minimum_education,
            'minimum_experience_years' => (int) $template->minimum_experience_years,
            'minimumExperienceYears' => (int) $template->minimum_experience_years,
            'salary_min' => $template->salary_min,
            'salaryMin' => $template->salary_min,
            'salary_max' => $template->salary_max,
            'salaryMax' => $template->salary_max,
            'skills' => $this->parseSkills($template->required_skills),
        ];
    }
}
