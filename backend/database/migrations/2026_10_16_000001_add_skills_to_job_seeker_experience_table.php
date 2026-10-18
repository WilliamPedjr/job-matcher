<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_seeker_experience', function (Blueprint $table) {
            $table->json('skills')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('job_seeker_experience', function (Blueprint $table) {
            $table->dropColumn('skills');
        });
    }
};
