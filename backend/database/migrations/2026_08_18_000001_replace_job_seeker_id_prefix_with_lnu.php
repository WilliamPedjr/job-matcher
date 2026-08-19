<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('job_seekers')
            ->where('id_number', 'like', 'JS-%')
            ->update([
                'id_number' => DB::raw("CONCAT('LNU-', SUBSTRING(id_number, 4))"),
            ]);

        DB::table('uploads')
            ->where('job_seeker_id_number', 'like', 'JS-%')
            ->update([
                'job_seeker_id_number' => DB::raw("CONCAT('LNU-', SUBSTRING(job_seeker_id_number, 4))"),
            ]);
    }

    public function down(): void
    {
        DB::table('job_seekers')
            ->where('id_number', 'like', 'LNU-%')
            ->update([
                'id_number' => DB::raw("CONCAT('JS-', SUBSTRING(id_number, 5))"),
            ]);

        DB::table('uploads')
            ->where('job_seeker_id_number', 'like', 'LNU-%')
            ->update([
                'job_seeker_id_number' => DB::raw("CONCAT('JS-', SUBSTRING(job_seeker_id_number, 5))"),
            ]);
    }
};
