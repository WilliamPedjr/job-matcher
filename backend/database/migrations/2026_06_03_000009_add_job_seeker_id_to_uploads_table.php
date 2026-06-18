<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('uploads', 'job_seeker_id')) {
            return;
        }

        Schema::table('uploads', function (Blueprint $table) {
            $table->foreignId('job_seeker_id')->nullable()->after('id')->constrained('job_seekers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('uploads', 'job_seeker_id')) {
            return;
        }

        Schema::table('uploads', function (Blueprint $table) {
            $table->dropConstrainedForeignId('job_seeker_id');
        });
    }
};
