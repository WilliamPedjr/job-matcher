<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_seekers', function (Blueprint $table) {
            if (!Schema::hasColumn('job_seekers', 'status')) {
                $table->string('status')->nullable()->after('phone');
            }
            if (!Schema::hasColumn('job_seekers', 'address')) {
                $table->string('address')->nullable()->after('status');
            }
            if (!Schema::hasColumn('job_seekers', 'about_text')) {
                $table->text('about_text')->nullable()->after('address');
            }
        });
    }

    public function down(): void
    {
        Schema::table('job_seekers', function (Blueprint $table) {
            if (Schema::hasColumn('job_seekers', 'about_text')) {
                $table->dropColumn('about_text');
            }
            if (Schema::hasColumn('job_seekers', 'address')) {
                $table->dropColumn('address');
            }
            if (Schema::hasColumn('job_seekers', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
