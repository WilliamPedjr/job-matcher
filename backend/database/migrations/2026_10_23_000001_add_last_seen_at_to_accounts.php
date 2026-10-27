<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['users', 'employers', 'job_seekers'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->timestamp('last_seen_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['users', 'employers', 'job_seekers'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn('last_seen_at'));
        }
    }
};
