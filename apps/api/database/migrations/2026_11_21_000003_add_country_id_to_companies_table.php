<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->foreignId('country_id')
                ->nullable()
                ->after('id')
                ->constrained('countries')
                ->restrictOnDelete();
        });

        $needsBackfill = DB::table('companies')->whereNull('country_id')->exists();
        if ($needsBackfill) {
            $australiaId = DB::table('countries')->where('code', 'AU')->value('id');
            if ($australiaId === null) {
                throw new RuntimeException(
                    'Cannot backfill companies.country_id: Australia (AU) is missing. Run AustraliaCountrySeeder first.',
                );
            }

            DB::table('companies')->whereNull('country_id')->update(['country_id' => $australiaId]);
        }

        Schema::table('companies', function (Blueprint $table) {
            $table->unsignedBigInteger('country_id')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropConstrainedForeignId('country_id');
        });
    }
};
