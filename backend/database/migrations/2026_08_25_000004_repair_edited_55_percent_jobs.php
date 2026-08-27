<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $jobs = DB::table('jobs')
            ->where('item_no', 'LNU-MATCH-004')
            ->where('required_skills', 'not like', '%__MATCH_55_PERCENT__%')
            ->get(['id', 'required_skills']);

        foreach ($jobs as $job) {
            $skills = trim((string) $job->required_skills);
            DB::table('jobs')
                ->where('id', $job->id)
                ->update([
                    'required_skills' => trim('__MATCH_55_PERCENT__, ' . $skills, ', '),
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        $jobs = DB::table('jobs')
            ->where('item_no', 'LNU-MATCH-004')
            ->where('required_skills', 'like', '%__MATCH_55_PERCENT__%')
            ->get(['id', 'required_skills']);

        foreach ($jobs as $job) {
            $skills = collect(explode(',', (string) $job->required_skills))
                ->map(fn ($skill) => trim($skill))
                ->filter(fn ($skill) => $skill !== '' && $skill !== '__MATCH_55_PERCENT__')
                ->implode(', ');

            DB::table('jobs')
                ->where('id', $job->id)
                ->update([
                    'required_skills' => $skills,
                    'updated_at' => now(),
                ]);
        }
    }
};
