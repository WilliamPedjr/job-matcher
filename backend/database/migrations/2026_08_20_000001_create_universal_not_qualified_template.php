<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $template = [
        'title' => 'Universal Not Qualified Match',
        'description' => 'Open applicant pool for validating applications that should remain applyable while producing a not qualified result.',
        'department' => 'Human Resources',
        'job_position' => 'Non-Teaching',
        'item_no' => 'LNU-MATCH-003',
        'location' => 'Leyte Normal University',
        'type' => 'Full-time',
        'deadline' => '2099-12-31',
        'eligibility' => 'Open to all applicants with not qualified result',
        'required_skills' => '__MATCH_NOT_QUALIFIED__',
        'minimum_education' => 'Open to all education levels',
        'minimum_experience_years' => 0,
        'salary_min' => null,
        'salary_max' => null,
    ];

    public function up(): void
    {
        DB::table('job_templates')->updateOrInsert(
            ['title' => $this->template['title']],
            [
                ...$this->template,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('job_templates')
            ->where('title', $this->template['title'])
            ->delete();
    }
};
