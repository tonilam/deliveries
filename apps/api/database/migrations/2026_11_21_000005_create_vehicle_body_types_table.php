<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_body_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_category_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->decimal('capacity', 12, 3);
            $table->string('capacity_unit');
            $table->unsignedInteger('pallet_spaces')->nullable();
            $table->decimal('cubic_metres', 10, 2)->nullable();
            $table->unsignedInteger('payload_kg')->nullable();
            $table->text('description')->nullable();
            $table->json('option_values')->nullable();
            $table->timestamps();

            $table->unique(['vehicle_category_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_body_types');
    }
};
