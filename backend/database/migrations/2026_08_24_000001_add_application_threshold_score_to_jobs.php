<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            if (!Schema::hasColumn('jobs', 'application_threshold_score')) {
                $table->unsignedTinyInteger('application_threshold_score')->default(50)->after('minimum_experience_years');
            }
        });

        Schema::table('job_templates', function (Blueprint $table) {
            if (!Schema::hasColumn('job_templates', 'application_threshold_score')) {
                $table->unsignedTinyInteger('application_threshold_score')->default(50)->after('minimum_experience_years');
            }
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            if (Schema::hasColumn('jobs', 'application_threshold_score')) {
                $table->dropColumn('application_threshold_score');
            }
        });

        Schema::table('job_templates', function (Blueprint $table) {
            if (Schema::hasColumn('job_templates', 'application_threshold_score')) {
                $table->dropColumn('application_threshold_score');
            }
        });
    }
};
