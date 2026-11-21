<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('rate_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('profile_name');
            $table->string('user_type');
            $table->decimal('minimum_price', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'profile_name']);
        });

        Schema::create('rate_card_companies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rate_card_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();

            $table->unique(['rate_card_id', 'company_id']);
        });

        Schema::create('rate_card_zones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rate_card_id')->constrained()->cascadeOnDelete();
            $table->foreignId('collection_zone_id')->constrained('zones');
            $table->foreignId('delivery_zone_id')->constrained('zones');
            $table->decimal('base_rate', 12, 2);
            $table->decimal('fuel_surcharge_percent', 8, 2)->default(0);
            $table->timestamps();

            $table->unique(
                ['rate_card_id', 'collection_zone_id', 'delivery_zone_id'],
                'rate_card_zones_lane_unique',
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rate_card_zones');
        Schema::dropIfExists('rate_card_companies');
        Schema::dropIfExists('rate_cards');
    }
};
