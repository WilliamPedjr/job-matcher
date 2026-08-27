<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('job_templates')
            ->where('title', 'Universal 55 Percent Match')
            ->update([
                'salary_min' => 1,
                'salary_max' => 1,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('job_templates')
            ->where('title', 'Universal 55 Percent Match')
            ->update([
                'salary_min' => null,
                'salary_max' => null,
                'updated_at' => now(),
            ]);
    }
};
