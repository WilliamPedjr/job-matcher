<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (!Schema::hasColumn('uploads', 'match_score')) {
                $table->float('match_score')->nullable();
            }

            if (!Schema::hasColumn('uploads', 'project_score')) {
                $table->float('project_score')->nullable();
            }

            if (!Schema::hasColumn('uploads', 'extracted_text')) {
                $table->longText('extracted_text')->nullable();
            }

            if (!Schema::hasColumn('uploads', 'education_json')) {
                $table->json('education_json')->nullable();
            }

            if (!Schema::hasColumn('uploads', 'experience_json')) {
                $table->json('experience_json')->nullable();
            }

            if (!Schema::hasColumn('uploads', 'summary_text')) {
                $table->longText('summary_text')->nullable();
            }

            if (!Schema::hasColumn('uploads', 'resume_summary')) {
                $table->json('resume_summary')->nullable();
            }

            if (!Schema::hasColumn('uploads', 'job_seeker_hidden')) {
                $table->boolean('job_seeker_hidden')->default(false);
            }

            if (!Schema::hasColumn('uploads', 'job_seeker_hidden_at')) {
                $table->timestamp('job_seeker_hidden_at')->nullable();
            }

            if (!Schema::hasColumn('uploads', 'size_bytes')) {
                $table->unsignedBigInteger('size_bytes')->nullable();
            }

            if (!Schema::hasColumn('uploads', 'uploaded_at')) {
                $table->timestamp('uploaded_at')->nullable();
            }
        });

        Schema::table('job_seeker_supporting_files', function (Blueprint $table) {
            if (!Schema::hasColumn('job_seeker_supporting_files', 'size_bytes')) {
                $table->unsignedBigInteger('size_bytes')->nullable();
            }

            if (!Schema::hasColumn('job_seeker_supporting_files', 'uploaded_at')) {
                $table->timestamp('uploaded_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (Schema::hasColumn('uploads', 'resume_summary')) {
                $table->dropColumn('resume_summary');
            }

            if (Schema::hasColumn('uploads', 'summary_text')) {
                $table->dropColumn('summary_text');
            }
        });

        Schema::table('job_seeker_supporting_files', function (Blueprint $table) {
            if (Schema::hasColumn('job_seeker_supporting_files', 'size_bytes')) {
                $table->dropColumn('size_bytes');
            }
        });
    }
};
