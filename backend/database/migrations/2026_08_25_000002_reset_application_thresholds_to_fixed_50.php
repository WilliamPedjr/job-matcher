<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('jobs', 'application_threshold_score')) {
            DB::table('jobs')->update(['application_threshold_score' => 50]);
        }

        if (Schema::hasColumn('job_templates', 'application_threshold_score')) {
            DB::table('job_templates')->update(['application_threshold_score' => 50]);
        }
    }

    public function down(): void
    {
        // Threshold is now fixed in code, so there is no previous per-row value to restore.
    }
};
