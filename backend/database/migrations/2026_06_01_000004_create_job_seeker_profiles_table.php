<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_seeker_education', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_seeker_id')->constrained('job_seekers')->cascadeOnDelete();
            $table->string('school_name')->nullable();
            $table->string('degree')->nullable();
            $table->string('start_year')->nullable();
            $table->string('end_year')->nullable();
            $table->longText('description')->nullable();
            $table->timestamps();
        });

        Schema::create('job_seeker_experience', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_seeker_id')->constrained('job_seekers')->cascadeOnDelete();
            $table->string('company_name')->nullable();
            $table->string('position')->nullable();
            $table->string('start_date')->nullable();
            $table->string('end_date')->nullable();
            $table->longText('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_seeker_experience');
        Schema::dropIfExists('job_seeker_education');
    }
};
