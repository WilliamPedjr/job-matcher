<?php

namespace Database\Seeders;

use App\Models\GlobalSkillCatalog;
use App\Models\Job;
use App\Models\JobSkillCatalog;
use App\Models\JobTemplate;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        $localSeedDir = database_path('seeders' . DIRECTORY_SEPARATOR . 'data');
        $legacyServerDir = dirname(base_path()) . DIRECTORY_SEPARATOR . 'server';
        $jobsPath = File::exists($localSeedDir . DIRECTORY_SEPARATOR . 'jobs.json')
            ? $localSeedDir . DIRECTORY_SEPARATOR . 'jobs.json'
            : $legacyServerDir . DIRECTORY_SEPARATOR . 'jobs.json';
        $skillsPath = File::exists($localSeedDir . DIRECTORY_SEPARATOR . 'skills.json')
            ? $localSeedDir . DIRECTORY_SEPARATOR . 'skills.json'
            : $legacyServerDir . DIRECTORY_SEPARATOR . 'skills.json';

        if (File::exists($jobsPath)) {
            $jobs = json_decode(File::get($jobsPath), true) ?: [];
            $seedIds = collect($jobs)
                ->map(fn ($seed, $index) => $seed['id'] ?? $index + 1)
                ->map(fn ($id) => (int) $id)
                ->all();
            $seedTitles = collect($jobs)
                ->pluck('title')
                ->filter()
                ->map(fn ($title) => trim((string) $title))
                ->all();
            $previousSeedTitles = [
                'Frontend Developer',
                'Backend Developer',
                'Full Stack Developer',
                'UI/UX Designer',
                'QA Tester',
                'Database Administrator',
                'HR Recruitment Assistant',
                'IT Support Specialist',
            ];

            if ($seedIds) {
                Job::query()
                    ->where('source', 'template')
                    ->whereNotIn('template_id', $seedIds)
                    ->delete();
            }

            if (Schema::hasTable('job_templates')) {
                JobTemplate::query()
                    ->whereIn('title', array_diff($previousSeedTitles, $seedTitles))
                    ->delete();
            }

            foreach ($jobs as $index => $seed) {
                if (empty($seed['title']) || empty($seed['description'])) {
                    continue;
                }

                $job = Job::query()->updateOrCreate(
                    ['template_id' => $seed['id'] ?? $index + 1, 'source' => 'template'],
                    [
                        'title' => trim((string) ($seed['title'] ?? '')),
                        'description' => trim((string) ($seed['description'] ?? '')),
                        'status' => in_array(strtolower((string) ($seed['status'] ?? 'active')), ['active', 'closed'], true)
                            ? strtolower((string) ($seed['status'] ?? 'active'))
                            : 'active',
                        'department' => $seed['department'] ?? 'Information Technology',
                        'job_position' => $seed['jobPosition'] ?? $seed['job_position'] ?? null,
                        'item_no' => $seed['itemNo'] ?? $seed['item_no'] ?? null,
                        'location' => $seed['location'] ?? 'Manila, Philippines',
                        'type' => $seed['type'] ?? 'Full-time',
                        'deadline' => $seed['deadline'] ?? null,
                        'eligibility' => $seed['eligibility'] ?? null,
                        'required_skills' => $seed['requiredSkills'] ?? '',
                        'minimum_education' => $seed['minimumEducation'] ?? '',
                        'minimum_experience_years' => (int) ($seed['minimumExperienceYears'] ?? 0),
                        'salary_min' => $seed['salaryMin'] ?? null,
                        'salary_max' => $seed['salaryMax'] ?? null,
                    ]
                );

                if (Schema::hasTable('job_templates')) {
                    JobTemplate::query()->updateOrCreate(
                        ['title' => trim((string) ($seed['title'] ?? ''))],
                        [
                            'description' => trim((string) ($seed['description'] ?? '')),
                            'department' => $seed['department'] ?? 'Information Technology',
                            'job_position' => $seed['jobPosition'] ?? $seed['job_position'] ?? null,
                            'item_no' => $seed['itemNo'] ?? $seed['item_no'] ?? null,
                            'location' => $seed['location'] ?? 'Leyte Normal University',
                            'type' => $seed['type'] ?? 'Full-time',
                            'deadline' => $seed['deadline'] ?? null,
                            'eligibility' => $seed['eligibility'] ?? null,
                            'required_skills' => $seed['requiredSkills'] ?? '',
                            'minimum_education' => $seed['minimumEducation'] ?? '',
                            'minimum_experience_years' => (int) ($seed['minimumExperienceYears'] ?? 0),
                            'salary_min' => $seed['salaryMin'] ?? null,
                            'salary_max' => $seed['salaryMax'] ?? null,
                        ]
                    );
                }

                $skills = array_values(array_filter(array_map(
                    'trim',
                    preg_split('/[,;\n|]+/', (string) ($seed['requiredSkills'] ?? '')) ?: []
                )));

                JobSkillCatalog::query()
                    ->where('job_id', $job->id)
                    ->when(
                        $skills,
                        fn ($query) => $query->whereNotIn('skill', $skills),
                        fn ($query) => $query
                    )
                    ->delete();

                foreach ($skills as $skill) {
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
