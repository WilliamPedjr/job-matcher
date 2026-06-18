<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('uploads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_seeker_id')->nullable()->constrained('job_seekers')->nullOnDelete();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('applied_job_title')->nullable();
            $table->string('original_name')->nullable();
            $table->string('saved_name')->nullable();
            $table->string('file_path')->nullable();
            $table->string('file_type')->nullable();
            $table->string('mime_type')->nullable();
            $table->string('classification')->nullable();
            $table->float('overall_score')->nullable();
            $table->float('skills_match_score')->nullable();
            $table->float('education_match_score')->nullable();
            $table->float('experience_match_score')->nullable();
            $table->string('matched_job_title')->nullable();
            $table->json('matched_skills')->nullable();
            $table->json('missing_skills')->nullable();
            $table->longText('education_text')->nullable();
            $table->longText('experience_text')->nullable();
            $table->longText('resume_text')->nullable();
            $table->boolean('hidden')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('uploads');
    }
};
