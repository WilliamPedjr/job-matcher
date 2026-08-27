<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $template = [
        'title' => 'Universal 55 Percent Match',
        'description' => 'Open applicant pool for validating applications that should always produce a 55 percent match result.',
        'department' => 'Human Resources',
        'job_position' => 'Non-Teaching',
        'item_no' => 'LNU-MATCH-004',
        'location' => 'Leyte Normal University',
        'type' => 'Full-time',
        'deadline' => '2099-12-31',
        'eligibility' => 'Open to all applicants with fixed 55 percent match',
        'required_skills' => '__MATCH_55_PERCENT__',
        'minimum_education' => 'Open to all education levels',
        'minimum_experience_years' => 0,
        'salary_min' => 1,
        'salary_max' => 1,
    ];

    public function up(): void
    {
        $values = [
            ...$this->template,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('job_templates', 'application_threshold_score')) {
            $values['application_threshold_score'] = 50;
        }

        DB::table('job_templates')->updateOrInsert(
            ['title' => $this->template['title']],
            $values
        );
    }

    public function down(): void
    {
        DB::table('job_templates')
            ->where('title', $this->template['title'])
            ->delete();
    }
};
