<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_load_id')->nullable()->constrained('loads')->cascadeOnDelete();
            $table->string('type', 16);
            $table->foreignId('customer_company_id')->constrained('companies')->restrictOnDelete();
            $table->foreignId('provider_company_id')->constrained('companies')->restrictOnDelete();
            $table->foreignId('secondary_provider_company_id')->nullable()->constrained('companies')->restrictOnDelete();
            $table->foreignId('collection_address_id')->constrained('addresses')->restrictOnDelete();
            $table->foreignId('delivery_address_id')->nullable()->constrained('addresses')->restrictOnDelete();
            $table->foreignId('xdock_address_id')->nullable()->constrained('addresses')->restrictOnDelete();
            $table->unsignedInteger('pallet_count');
            $table->timestamps();

            $table->index(['company_id', 'parent_load_id']);
            $table->index(['company_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loads');
    }
};
