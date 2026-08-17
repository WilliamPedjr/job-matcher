<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_seekers', function (Blueprint $table) {
            if (!Schema::hasColumn('job_seekers', 'id_number')) {
                $table->string('id_number')->nullable()->unique()->after('id');
            }
        });

        Schema::table('uploads', function (Blueprint $table) {
            if (!Schema::hasColumn('uploads', 'job_seeker_id_number')) {
                $table->string('job_seeker_id_number')->nullable()->after('job_seeker_id');
            }
        });

        DB::table('job_seekers')
            ->whereNull('id_number')
            ->orderBy('id')
            ->get(['id'])
            ->each(function ($jobSeeker) {
                DB::table('job_seekers')
                    ->where('id', $jobSeeker->id)
                    ->update(['id_number' => sprintf('JS-%06d', $jobSeeker->id)]);
            });

        DB::table('uploads')
            ->join('job_seekers', 'uploads.job_seeker_id', '=', 'job_seekers.id')
            ->whereNull('uploads.job_seeker_id_number')
            ->update(['uploads.job_seeker_id_number' => DB::raw('job_seekers.id_number')]);
    }

    public function down(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (Schema::hasColumn('uploads', 'job_seeker_id_number')) {
                $table->dropColumn('job_seeker_id_number');
            }
        });

        Schema::table('job_seekers', function (Blueprint $table) {
            if (Schema::hasColumn('job_seekers', 'id_number')) {
                $table->dropUnique(['id_number']);
                $table->dropColumn('id_number');
            }
        });
    }
};
