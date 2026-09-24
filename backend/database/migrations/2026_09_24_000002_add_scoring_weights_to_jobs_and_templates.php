<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            if (!Schema::hasColumn('jobs', 'skills_weight')) {
                $table->unsignedTinyInteger('skills_weight')->default(20)->after('application_threshold_score');
            }
            if (!Schema::hasColumn('jobs', 'training_weight')) {
                $table->unsignedTinyInteger('training_weight')->default(20)->after('skills_weight');
            }
            if (!Schema::hasColumn('jobs', 'education_weight')) {
                $table->unsignedTinyInteger('education_weight')->default(20)->after('training_weight');
            }
            if (!Schema::hasColumn('jobs', 'experience_weight')) {
                $table->unsignedTinyInteger('experience_weight')->default(20)->after('education_weight');
            }
            if (!Schema::hasColumn('jobs', 'eligibility_weight')) {
                $table->unsignedTinyInteger('eligibility_weight')->default(20)->after('experience_weight');
            }
        });

        Schema::table('job_templates', function (Blueprint $table) {
            if (!Schema::hasColumn('job_templates', 'skills_weight')) {
                $table->unsignedTinyInteger('skills_weight')->default(20)->after('application_threshold_score');
            }
            if (!Schema::hasColumn('job_templates', 'training_weight')) {
                $table->unsignedTinyInteger('training_weight')->default(20)->after('skills_weight');
            }
            if (!Schema::hasColumn('job_templates', 'education_weight')) {
                $table->unsignedTinyInteger('education_weight')->default(20)->after('training_weight');
            }
            if (!Schema::hasColumn('job_templates', 'experience_weight')) {
                $table->unsignedTinyInteger('experience_weight')->default(20)->after('education_weight');
            }
            if (!Schema::hasColumn('job_templates', 'eligibility_weight')) {
                $table->unsignedTinyInteger('eligibility_weight')->default(20)->after('experience_weight');
            }
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            foreach (['eligibility_weight', 'experience_weight', 'education_weight', 'training_weight', 'skills_weight'] as $column) {
                if (Schema::hasColumn('jobs', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('job_templates', function (Blueprint $table) {
            foreach (['eligibility_weight', 'experience_weight', 'education_weight', 'training_weight', 'skills_weight'] as $column) {
                if (Schema::hasColumn('job_templates', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
