<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_seeker_supporting_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_seeker_id')->constrained('job_seekers')->cascadeOnDelete();
            $table->foreignId('upload_id')->nullable()->constrained('uploads')->nullOnDelete();
            $table->string('doc_type')->default('others');
            $table->string('original_name')->nullable();
            $table->string('saved_name')->nullable();
            $table->string('file_path')->nullable();
            $table->string('mime_type')->nullable();
            $table->longText('extracted_text')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_seeker_supporting_files');
    }
};
