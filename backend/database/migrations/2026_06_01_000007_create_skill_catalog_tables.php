<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_skill_catalog', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_id')->constrained('jobs')->cascadeOnDelete();
            $table->string('skill');
            $table->timestamps();
            $table->unique(['job_id', 'skill']);
        });

        Schema::create('global_skill_catalog', function (Blueprint $table) {
            $table->id();
            $table->string('skill')->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('global_skill_catalog');
        Schema::dropIfExists('job_skill_catalog');
    }
};
