<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_body_type_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_body_type_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->string('label');
            $table->string('data_type');
            $table->string('visibility');
            $table->boolean('required')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['vehicle_body_type_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_body_type_options');
    }
};
