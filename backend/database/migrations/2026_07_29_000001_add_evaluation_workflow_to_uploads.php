<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('uploads', function (Blueprint $table) {
            if (!Schema::hasColumn('uploads', 'evaluation_status')) {
                $table->string('evaluation_status')->nullable()->after('job_seeker_hidden_at');
            }
            if (!Schema::hasColumn('uploads', 'evaluation_started_at')) {
                $table->timestamp('evaluation_started_at')->nullable()->after('evaluation_status');
            }
        });

        Schema::create('application_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upload_id')->constrained('uploads')->cascadeOnDelete();
            $table->string('rater_name')->nullable();
            $table->string('rater_email')->nullable();
            $table->json('scores')->nullable();
            $table->unsignedInteger('total_score')->default(0);
            $table->float('percentage_score')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_ratings');

        Schema::table('uploads', function (Blueprint $table) {
            foreach (['evaluation_started_at', 'evaluation_status'] as $column) {
                if (Schema::hasColumn('uploads', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
