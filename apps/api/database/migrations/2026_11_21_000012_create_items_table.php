<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('good_type_code', 8);
            $table->foreign('good_type_code')->references('code')->on('good_types')->restrictOnDelete();
            $table->decimal('weight_tonnes', 14, 6);
            $table->string('display_unit', 16);
            $table->string('order_number')->nullable();
            $table->string('connote')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
