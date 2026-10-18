<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (!Schema::hasColumn('uploads', 'interview_place')) {
                $column = $table->string('interview_place')->nullable();
                if (Schema::hasColumn('uploads', 'interview_date')) {
                    $column->after('interview_date');
                }
            }

            if (!Schema::hasColumn('uploads', 'interview_time')) {
                $column = $table->time('interview_time')->nullable();
                if (Schema::hasColumn('uploads', 'interview_place')) {
                    $column->after('interview_place');
                } elseif (Schema::hasColumn('uploads', 'interview_date')) {
                    $column->after('interview_date');
                }
            }

            if (!Schema::hasColumn('uploads', 'interview_preparation_notes')) {
                $column = $table->text('interview_preparation_notes')->nullable();
                if (Schema::hasColumn('uploads', 'interview_time')) {
                    $column->after('interview_time');
                } elseif (Schema::hasColumn('uploads', 'interview_place')) {
                    $column->after('interview_place');
                } elseif (Schema::hasColumn('uploads', 'interview_date')) {
                    $column->after('interview_date');
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (Schema::hasColumn('uploads', 'interview_preparation_notes')) {
                $table->dropColumn('interview_preparation_notes');
            }

            if (Schema::hasColumn('uploads', 'interview_time')) {
                $table->dropColumn('interview_time');
            }

            if (Schema::hasColumn('uploads', 'interview_place')) {
                $table->dropColumn('interview_place');
            }
        });
    }
};
