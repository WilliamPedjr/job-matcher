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
            if (!Schema::hasColumn('job_seekers', 'email_verified_at')) {
                $table->timestamp('email_verified_at')->nullable()->after('email');
            }
            if (!Schema::hasColumn('job_seekers', 'email_verification_token')) {
                $table->string('email_verification_token', 100)->nullable()->unique()->after('email_verified_at');
            }
            if (!Schema::hasColumn('job_seekers', 'email_verification_sent_at')) {
                $table->timestamp('email_verification_sent_at')->nullable()->after('email_verification_token');
            }
        });

        DB::table('job_seekers')
            ->whereNull('email_verified_at')
            ->update(['email_verified_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('job_seekers', function (Blueprint $table) {
            if (Schema::hasColumn('job_seekers', 'email_verification_sent_at')) {
                $table->dropColumn('email_verification_sent_at');
            }
            if (Schema::hasColumn('job_seekers', 'email_verification_token')) {
                $table->dropUnique('job_seekers_email_verification_token_unique');
                $table->dropColumn('email_verification_token');
            }
            if (Schema::hasColumn('job_seekers', 'email_verified_at')) {
                $table->dropColumn('email_verified_at');
            }
        });
    }
};
