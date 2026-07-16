<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('job_templates')) {
            return;
        }

        Schema::create('job_templates', function (Blueprint $table) {
            $table->id();
            $table->string('title')->unique();
            $table->longText('description');
            $table->string('department')->nullable();
            $table->string('location')->nullable();
            $table->string('type')->nullable();
            $table->longText('required_skills')->nullable();
            $table->longText('minimum_education')->nullable();
            $table->unsignedInteger('minimum_experience_years')->default(0);
            $table->unsignedInteger('salary_min')->nullable();
            $table->unsignedInteger('salary_max')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_templates');
    }
};
