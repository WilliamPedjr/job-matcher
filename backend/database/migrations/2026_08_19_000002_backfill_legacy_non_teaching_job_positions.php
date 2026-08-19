<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('jobs')
            ->whereNull('job_position')
            ->where(function ($query) {
                $query
                    ->where('title', 'like', '%Developer%')
                    ->orWhere('title', 'like', '%Designer%')
                    ->orWhere('title', 'like', '%Tester%')
                    ->orWhere('title', 'like', '%Database Administrator%')
                    ->orWhere('title', 'like', '%IT Support%')
                    ->orWhere('title', 'like', '%HR Recruitment%');
            })
            ->update(['job_position' => 'Non-Teaching']);

        DB::table('uploads')
            ->join('jobs', 'uploads.job_id', '=', 'jobs.id')
            ->whereNull('uploads.job_position_type')
            ->whereNotNull('jobs.job_position')
            ->update(['uploads.job_position_type' => DB::raw('jobs.job_position')]);
    }

    public function down(): void
    {
        DB::table('uploads')
            ->join('jobs', 'uploads.job_id', '=', 'jobs.id')
            ->where('uploads.job_position_type', 'Non-Teaching')
            ->where(function ($query) {
                $query
                    ->where('jobs.title', 'like', '%Developer%')
                    ->orWhere('jobs.title', 'like', '%Designer%')
                    ->orWhere('jobs.title', 'like', '%Tester%')
                    ->orWhere('jobs.title', 'like', '%Database Administrator%')
                    ->orWhere('jobs.title', 'like', '%IT Support%')
                    ->orWhere('jobs.title', 'like', '%HR Recruitment%');
            })
            ->update(['uploads.job_position_type' => null]);

        DB::table('jobs')
            ->where('job_position', 'Non-Teaching')
            ->where(function ($query) {
                $query
                    ->where('title', 'like', '%Developer%')
                    ->orWhere('title', 'like', '%Designer%')
                    ->orWhere('title', 'like', '%Tester%')
                    ->orWhere('title', 'like', '%Database Administrator%')
                    ->orWhere('title', 'like', '%IT Support%')
                    ->orWhere('title', 'like', '%HR Recruitment%');
            })
            ->update(['job_position' => null]);
    }
};
