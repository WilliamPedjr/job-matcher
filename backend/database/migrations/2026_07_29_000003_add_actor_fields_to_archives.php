<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archives', function (Blueprint $table) {
            if (!Schema::hasColumn('archives', 'actor_name')) {
                $table->string('actor_name')->nullable()->after('data');
            }
            if (!Schema::hasColumn('archives', 'actor_email')) {
                $table->string('actor_email')->nullable()->after('actor_name');
            }
            if (!Schema::hasColumn('archives', 'actor_role')) {
                $table->string('actor_role')->nullable()->after('actor_email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('archives', function (Blueprint $table) {
            foreach (['actor_role', 'actor_email', 'actor_name'] as $column) {
                if (Schema::hasColumn('archives', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
