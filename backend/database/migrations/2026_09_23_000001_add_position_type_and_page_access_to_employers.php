<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employers', function (Blueprint $table) {
            if (!Schema::hasColumn('employers', 'position_type')) {
                $table->string('position_type')->nullable()->after('full_name');
            }

            if (!Schema::hasColumn('employers', 'page_access')) {
                $table->json('page_access')->nullable()->after('position_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('employers', function (Blueprint $table) {
            if (Schema::hasColumn('employers', 'page_access')) {
                $table->dropColumn('page_access');
            }

            if (Schema::hasColumn('employers', 'position_type')) {
                $table->dropColumn('position_type');
            }
        });
    }
};
