<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employers', function (Blueprint $table) {
            if (!Schema::hasColumn('employers', 'remember_token')) {
                $table->rememberToken();
            }
        });

        Schema::table('job_seekers', function (Blueprint $table) {
            if (!Schema::hasColumn('job_seekers', 'remember_token')) {
                $table->rememberToken();
            }
        });
    }

    public function down(): void
    {
        Schema::table('employers', function (Blueprint $table) {
            if (Schema::hasColumn('employers', 'remember_token')) {
                $table->dropRememberToken();
            }
        });

        Schema::table('job_seekers', function (Blueprint $table) {
            if (Schema::hasColumn('job_seekers', 'remember_token')) {
                $table->dropRememberToken();
            }
        });
    }
};
