<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            if (!Schema::hasColumn('jobs', 'item_no')) {
                $table->string('item_no')->nullable()->after('department');
            }
            if (!Schema::hasColumn('jobs', 'deadline')) {
                $table->date('deadline')->nullable()->after('type');
            }
            if (!Schema::hasColumn('jobs', 'eligibility')) {
                $table->string('eligibility')->nullable()->after('deadline');
            }
        });

        Schema::table('job_templates', function (Blueprint $table) {
            if (!Schema::hasColumn('job_templates', 'item_no')) {
                $table->string('item_no')->nullable()->after('department');
            }
            if (!Schema::hasColumn('job_templates', 'deadline')) {
                $table->date('deadline')->nullable()->after('type');
            }
            if (!Schema::hasColumn('job_templates', 'eligibility')) {
                $table->string('eligibility')->nullable()->after('deadline');
            }
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            foreach (['eligibility', 'deadline', 'item_no'] as $column) {
                if (Schema::hasColumn('jobs', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('job_templates', function (Blueprint $table) {
            foreach (['eligibility', 'deadline', 'item_no'] as $column) {
                if (Schema::hasColumn('job_templates', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
