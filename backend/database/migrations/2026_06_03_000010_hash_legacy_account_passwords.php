<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach (['users', 'employers', 'job_seekers'] as $table) {
            $rows = DB::table($table)->select('id', 'password')->get();

            foreach ($rows as $row) {
                $password = (string) ($row->password ?? '');

                if ($password === '' || $this->looksHashed($password)) {
                    continue;
                }

                DB::table($table)
                    ->where('id', $row->id)
                    ->update([
                        'password' => Hash::make($password),
                    ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Intentionally left blank. Plain-text passwords cannot be safely restored.
    }

    private function looksHashed(string $password): bool
    {
        return preg_match('/^(\\$2y\\$|\\$2a\\$|\\$2b\\$|\\$argon2i\\$|\\$argon2id\\$)/', $password) === 1;
    }
};
