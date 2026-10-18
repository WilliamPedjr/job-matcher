<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (!Schema::hasColumn('uploads', 'demonstration_date')) {
                $afterColumn = Schema::hasColumn('uploads', 'interview_date') ? 'interview_date' : 'evaluation_started_at';
                $table->date('demonstration_date')->nullable()->after($afterColumn);
            }
        });
    }

    public function down(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (Schema::hasColumn('uploads', 'demonstration_date')) {
                $table->dropColumn('demonstration_date');
            }
        });
    }
};
