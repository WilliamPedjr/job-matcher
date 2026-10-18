<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (!Schema::hasColumn('uploads', 'demonstration_time')) {
                $column = $table->time('demonstration_time')->nullable();
                if (Schema::hasColumn('uploads', 'demonstration_date')) {
                    $column->after('demonstration_date');
                }
            }

            if (!Schema::hasColumn('uploads', 'demonstration_place')) {
                $column = $table->string('demonstration_place')->nullable();
                if (Schema::hasColumn('uploads', 'demonstration_time')) {
                    $column->after('demonstration_time');
                } elseif (Schema::hasColumn('uploads', 'demonstration_date')) {
                    $column->after('demonstration_date');
                }
            }

            if (!Schema::hasColumn('uploads', 'demonstration_preparation_notes')) {
                $column = $table->text('demonstration_preparation_notes')->nullable();
                if (Schema::hasColumn('uploads', 'demonstration_place')) {
                    $column->after('demonstration_place');
                } elseif (Schema::hasColumn('uploads', 'demonstration_time')) {
                    $column->after('demonstration_time');
                } elseif (Schema::hasColumn('uploads', 'demonstration_date')) {
                    $column->after('demonstration_date');
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (Schema::hasColumn('uploads', 'demonstration_preparation_notes')) {
                $table->dropColumn('demonstration_preparation_notes');
            }

            if (Schema::hasColumn('uploads', 'demonstration_place')) {
                $table->dropColumn('demonstration_place');
            }

            if (Schema::hasColumn('uploads', 'demonstration_time')) {
                $table->dropColumn('demonstration_time');
            }
        });
    }
};
