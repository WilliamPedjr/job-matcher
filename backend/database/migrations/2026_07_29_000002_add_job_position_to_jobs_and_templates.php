<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            if (!Schema::hasColumn('jobs', 'job_position')) {
                $table->string('job_position')->nullable()->after('department');
            }
        });

        Schema::table('job_templates', function (Blueprint $table) {
            if (!Schema::hasColumn('job_templates', 'job_position')) {
                $table->string('job_position')->nullable()->after('department');
            }
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            if (Schema::hasColumn('jobs', 'job_position')) {
                $table->dropColumn('job_position');
            }
        });

        Schema::table('job_templates', function (Blueprint $table) {
            if (Schema::hasColumn('job_templates', 'job_position')) {
                $table->dropColumn('job_position');
            }
        });
    }
};
