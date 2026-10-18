<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            if (!Schema::hasColumn('jobs', 'positions_total')) {
                $table->unsignedInteger('positions_total')->default(1)->after('salary_max');
            }
        });
    }

    public function down(): void
    {
        Schema::table('jobs', function (Blueprint $table) {
            if (Schema::hasColumn('jobs', 'positions_total')) {
                $table->dropColumn('positions_total');
            }
        });
    }
};
