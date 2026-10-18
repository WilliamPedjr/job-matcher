<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (!Schema::hasColumn('uploads', 'examination_date')) {
                $column = $table->date('examination_date')->nullable();
                if (Schema::hasColumn('uploads', 'demonstration_date')) {
                    $column->after('demonstration_date');
                } elseif (Schema::hasColumn('uploads', 'interview_date')) {
                    $column->after('interview_date');
                }
            }

            if (!Schema::hasColumn('uploads', 'examination_score')) {
                $column = $table->decimal('examination_score', 5, 2)->nullable();
                if (Schema::hasColumn('uploads', 'examination_date')) {
                    $column->after('examination_date');
                } elseif (Schema::hasColumn('uploads', 'demonstration_date')) {
                    $column->after('demonstration_date');
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (Schema::hasColumn('uploads', 'examination_score')) {
                $table->dropColumn('examination_score');
            }

            if (Schema::hasColumn('uploads', 'examination_date')) {
                $table->dropColumn('examination_date');
            }
        });
    }
};
