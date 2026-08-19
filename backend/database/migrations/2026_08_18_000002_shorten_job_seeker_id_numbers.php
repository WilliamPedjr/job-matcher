<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('job_seekers')
            ->orderBy('id')
            ->get(['id'])
            ->each(function ($jobSeeker) {
                DB::table('job_seekers')
                    ->where('id', $jobSeeker->id)
                    ->update(['id_number' => sprintf('LNU-%06d', $jobSeeker->id)]);
            });

        DB::table('uploads')
            ->join('job_seekers', 'uploads.job_seeker_id', '=', 'job_seekers.id')
            ->update(['uploads.job_seeker_id_number' => DB::raw('job_seekers.id_number')]);
    }

    public function down(): void
    {
        DB::table('job_seekers')
            ->orderBy('id')
            ->get(['id'])
            ->each(function ($jobSeeker) {
                DB::table('job_seekers')
                    ->where('id', $jobSeeker->id)
                    ->update(['id_number' => sprintf('JS-%06d', $jobSeeker->id)]);
            });

        DB::table('uploads')
            ->join('job_seekers', 'uploads.job_seeker_id', '=', 'job_seekers.id')
            ->update(['uploads.job_seeker_id_number' => DB::raw('job_seekers.id_number')]);
    }
};
