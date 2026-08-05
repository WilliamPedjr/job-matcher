<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Archive;
use App\Models\GlobalSkillCatalog;
use App\Models\Job;
use App\Models\JobSkillCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
                'data' => $archive->data ?? [],
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
}
