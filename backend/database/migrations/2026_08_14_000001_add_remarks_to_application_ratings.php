<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_ratings', function (Blueprint $table) {
            if (!Schema::hasColumn('application_ratings', 'remarks')) {
                $table->text('remarks')->nullable()->after('scores');
            }
        });
    }

    public function down(): void
    {
        Schema::table('application_ratings', function (Blueprint $table) {
            if (Schema::hasColumn('application_ratings', 'remarks')) {
                $table->dropColumn('remarks');
            }
        });
    }
};
