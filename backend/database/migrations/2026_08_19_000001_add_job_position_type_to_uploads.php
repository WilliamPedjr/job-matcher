<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('uploads', 'job_position_type')) {
            Schema::table('uploads', function (Blueprint $table) {
                $table->string('job_position_type')->nullable()->after('job_id');
            });
        }

        DB::table('uploads')
            ->join('jobs', 'uploads.job_id', '=', 'jobs.id')
            ->whereNull('uploads.job_position_type')
            ->update(['uploads.job_position_type' => DB::raw('jobs.job_position')]);

        DB::table('uploads')
            ->whereNull('job_position_type')
            ->whereNotNull('applied_job_title')
            ->orderBy('id')
            ->chunkById(100, function ($uploads) {
                foreach ($uploads as $upload) {
                    $title = trim((string) $upload->applied_job_title);
                    if ($title === '') {
                        continue;
                    }

                    $job = DB::table('jobs')
                        ->whereRaw('LOWER(title) = ?', [strtolower($title)])
                        ->orderByDesc('id')
                        ->first(['job_position']);

                    if ($job?->job_position) {
                        DB::table('uploads')
                            ->where('id', $upload->id)
                            ->update(['job_position_type' => $job->job_position]);
                    }
                }
            });
    }

    public function down(): void
    {
        if (Schema::hasColumn('uploads', 'job_position_type')) {
            Schema::table('uploads', function (Blueprint $table) {
                $table->dropColumn('job_position_type');
            });
        }
    }
};
