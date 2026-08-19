<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $jobs = [
            [
                'title' => 'Instructor I',
                'description' => 'Teach undergraduate courses, prepare instructional materials, assess student learning, and support academic program activities.',
                'department' => 'College of Education',
                'item_no' => 'LNU-TEACH-001',
                'required_skills' => 'Teaching, Lesson Planning, Classroom Management, Student Assessment, Curriculum Development',
                'minimum_education' => 'Bachelor degree relevant to the teaching assignment',
                'minimum_experience_years' => 1,
            ],
            [
                'title' => 'Assistant Professor I',
                'description' => 'Handle instruction, research, extension activities, student mentoring, and academic quality improvement initiatives.',
                'department' => 'College of Arts and Sciences',
                'item_no' => 'LNU-TEACH-002',
                'required_skills' => 'Teaching, Research, Academic Writing, Student Mentoring, Curriculum Development',
                'minimum_education' => 'Master degree relevant to the teaching assignment',
                'minimum_experience_years' => 2,
            ],
            [
                'title' => 'Guidance Counselor',
                'description' => 'Provide student counseling, career guidance, psychosocial support, case documentation, and wellness program coordination.',
                'department' => 'Student Affairs and Services',
                'item_no' => 'LNU-TEACH-003',
                'required_skills' => 'Counseling, Student Support, Career Guidance, Case Management, Communication',
                'minimum_education' => 'Bachelor degree in Guidance and Counseling, Psychology, or related field',
                'minimum_experience_years' => 1,
            ],
        ];

        foreach ($jobs as $job) {
            DB::table('jobs')->updateOrInsert(
                ['title' => $job['title']],
                [
                    'source' => 'db',
                    'description' => $job['description'],
                    'status' => 'active',
                    'department' => $job['department'],
                    'job_position' => 'Teaching',
                    'item_no' => $job['item_no'],
                    'location' => 'Leyte Normal University',
                    'type' => 'Full-time',
                    'deadline' => '2026-12-31',
                    'eligibility' => 'Open to all qualified applicants',
                    'required_skills' => $job['required_skills'],
                    'minimum_education' => $job['minimum_education'],
                    'minimum_experience_years' => $job['minimum_experience_years'],
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
        DB::table('jobs')->whereIn('title', [
            'Instructor I',
            'Assistant Professor I',
            'Guidance Counselor',
        ])->delete();
    }
};
