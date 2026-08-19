<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $templates = [
        [
            'title' => 'Universal Applicant Match',
            'description' => 'Open applicant pool for validating resume and PDS submissions. This posting accepts all readable applicant documents for review.',
            'department' => 'Human Resources',
            'job_position' => 'Non-Teaching',
            'item_no' => 'LNU-MATCH-001',
            'location' => 'Leyte Normal University',
            'type' => 'Full-time',
            'deadline' => '2099-12-31',
            'eligibility' => 'Open to all applicants',
            'required_skills' => '__MATCH_ALL__',
            'minimum_education' => 'Open to all education levels',
            'minimum_experience_years' => 0,
        ],
        [
            'title' => 'Universal Moderate Match',
            'description' => 'Open applicant pool for validating resume and PDS submissions with a moderate qualification result.',
            'department' => 'Human Resources',
            'job_position' => 'Non-Teaching',
            'item_no' => 'LNU-MATCH-002',
            'location' => 'Leyte Normal University',
            'type' => 'Full-time',
            'deadline' => '2099-12-31',
            'eligibility' => 'Open to all applicants with final review',
            'required_skills' => '__MATCH_MODERATE__',
            'minimum_education' => 'Open to all education levels',
            'minimum_experience_years' => 0,
        ],
    ];

    public function up(): void
    {
        DB::table('jobs')
            ->whereIn('title', array_column($this->templates, 'title'))
            ->delete();

        foreach ($this->templates as $template) {
            DB::table('job_templates')->updateOrInsert(
                ['title' => $template['title']],
                [
                    ...$template,
                    'salary_min' => null,
                    'salary_max' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        DB::table('job_templates')
            ->whereIn('title', array_column($this->templates, 'title'))
            ->delete();

        foreach ($this->templates as $template) {
            DB::table('jobs')->updateOrInsert(
                ['title' => $template['title']],
                [
                    'source' => 'db',
                    ...$template,
                    'status' => 'active',
                    'salary_min' => null,
                    'salary_max' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
};
