<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const TITLE = 'Universal Applicant Match';

    public function up(): void
    {
        DB::table('jobs')->updateOrInsert(
            ['title' => self::TITLE],
            [
                'source' => 'db',
                'description' => 'Open applicant pool for validating resume and PDS submissions. This posting accepts all readable applicant documents for review.',
                'status' => 'active',
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
