<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_vehicle_body_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_body_type_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'vehicle_body_type_id'], 'cvbt_company_body_type_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_vehicle_body_types');
    }
};
