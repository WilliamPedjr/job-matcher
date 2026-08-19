<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const TITLE = 'Universal Moderate Match';

    public function up(): void
    {
        DB::table('jobs')->updateOrInsert(
            ['title' => self::TITLE],
            [
                'source' => 'db',
                'description' => 'Open applicant pool for validating resume and PDS submissions with a moderate qualification result.',
                'status' => 'active',
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
                'salary_min' => null,
                'salary_max' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('jobs')->where('title', self::TITLE)->delete();
    }
};
