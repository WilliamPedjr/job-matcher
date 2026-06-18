<?php

namespace Database\Seeders;

use App\Models\GlobalSkillCatalog;
use App\Models\Job;
use App\Models\JobSkillCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        $repoRoot = dirname(base_path());
        $serverDir = $repoRoot . DIRECTORY_SEPARATOR . 'server';
        $jobsPath = $serverDir . DIRECTORY_SEPARATOR . 'jobs.json';
        $skillsPath = $serverDir . DIRECTORY_SEPARATOR . 'skills.json';

        if (File::exists($jobsPath)) {
            $jobs = json_decode(File::get($jobsPath), true) ?: [];

            foreach ($jobs as $index => $seed) {
                if (empty($seed['title']) || empty($seed['description'])) {
                    continue;
                }

                $job = Job::query()->updateOrCreate(
                    ['template_id' => $seed['id'] ?? $index + 1, 'source' => 'template'],
                    [
                        'title' => trim((string) ($seed['title'] ?? '')),
                        'description' => trim((string) ($seed['description'] ?? '')),
                        'status' => strtolower((string) ($seed['status'] ?? 'active')) === 'closed' ? 'closed' : 'active',
                        'department' => $seed['department'] ?? 'Information Technology',
                        'location' => $seed['location'] ?? 'Manila, Philippines',
                        'type' => $seed['type'] ?? 'Full-time',
                        'required_skills' => $seed['requiredSkills'] ?? '',
                        'minimum_education' => $seed['minimumEducation'] ?? '',
                        'minimum_experience_years' => (int) ($seed['minimumExperienceYears'] ?? 0),
                        'salary_min' => $seed['salaryMin'] ?? null,
                        'salary_max' => $seed['salaryMax'] ?? null,
                    ]
                );

                $skills = preg_split('/[,;\n|]+/', (string) ($seed['requiredSkills'] ?? '')) ?: [];
                foreach (array_values(array_filter(array_map('trim', $skills))) as $skill) {
                    JobSkillCatalog::query()->firstOrCreate([
                        'job_id' => $job->id,
                        'skill' => $skill,
                    ]);
                    GlobalSkillCatalog::query()->firstOrCreate(['skill' => $skill]);
                }
            }
        }

        if (File::exists($skillsPath)) {
            $parsed = json_decode(File::get($skillsPath), true) ?: [];
            $jobs = $parsed['jobs'] ?? [];
            foreach ($jobs as $skills) {
                $items = preg_split('/[,;\n|]+/', (string) $skills) ?: [];
                foreach (array_values(array_filter(array_map('trim', $items))) as $skill) {
                    GlobalSkillCatalog::query()->firstOrCreate(['skill' => $skill]);
                }
            }
        }
    }
}
