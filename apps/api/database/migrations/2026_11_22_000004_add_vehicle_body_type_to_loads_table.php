<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loads', function (Blueprint $table) {
            $table->foreignId('vehicle_body_type_id')
                ->nullable()
                ->after('dropoff_time')
                ->constrained('vehicle_body_types')
                ->nullOnDelete();
            $table->json('vehicle_option_values')->nullable()->after('vehicle_body_type_id');
        });
    }

    public function down(): void
    {
        Schema::table('loads', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vehicle_body_type_id');
            $table->dropColumn('vehicle_option_values');
        });
    }
};
