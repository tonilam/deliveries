<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $hasRows = DB::table('loads')->exists();

        if (! $hasRows) {
            Schema::table('loads', function (Blueprint $table) {
                $table->date('pickup_date')->after('pallet_count');
                $table->time('pickup_time')->after('pickup_date');
                $table->date('dropoff_date')->after('pickup_time');
                $table->time('dropoff_time')->after('dropoff_date');
            });

            return;
        }

        Schema::table('loads', function (Blueprint $table) {
            $table->date('pickup_date')->nullable()->after('pallet_count');
            $table->time('pickup_time')->nullable()->after('pickup_date');
            $table->date('dropoff_date')->nullable()->after('pickup_time');
            $table->time('dropoff_time')->nullable()->after('dropoff_date');
        });

        DB::table('loads')->orderBy('id')->lazyById()->each(function (object $row): void {
            $created = $row->created_at ?? now()->toDateTimeString();
            DB::table('loads')->where('id', $row->id)->update([
                'pickup_date' => date('Y-m-d', strtotime((string) $created)),
                'pickup_time' => '00:00:00',
                'dropoff_date' => date('Y-m-d', strtotime((string) $created)),
                'dropoff_time' => '00:00:00',
            ]);
        });

        Schema::table('loads', function (Blueprint $table) {
            $table->date('pickup_date')->nullable(false)->change();
            $table->time('pickup_time')->nullable(false)->change();
            $table->date('dropoff_date')->nullable(false)->change();
            $table->time('dropoff_time')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('loads', function (Blueprint $table) {
            $table->dropColumn(['pickup_date', 'pickup_time', 'dropoff_date', 'dropoff_time']);
        });
    }
};
