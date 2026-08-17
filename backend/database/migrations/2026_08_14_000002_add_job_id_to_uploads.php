<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('uploads', 'job_id')) {
            Schema::table('uploads', function (Blueprint $table) {
                $table->foreignId('job_id')
                    ->nullable()
                    ->after('job_seeker_id_number')
                    ->constrained('jobs')
                    ->nullOnDelete();
            });
        }

        DB::table('uploads')
            ->whereNull('job_id')
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
                        ->first();

                    if ($job) {
                        DB::table('uploads')
                            ->where('id', $upload->id)
                            ->update(['job_id' => $job->id]);
                    }
                }
            });
    }

    public function down(): void
    {
        if (Schema::hasColumn('uploads', 'job_id')) {
            Schema::table('uploads', function (Blueprint $table) {
                $table->dropConstrainedForeignId('job_id');
            });
        }
    }
};
