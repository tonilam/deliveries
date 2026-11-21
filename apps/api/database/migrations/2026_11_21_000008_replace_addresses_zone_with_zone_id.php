<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('addresses', 'zone_id')) {
            Schema::table('addresses', function (Blueprint $table) {
                $table->unsignedBigInteger('zone_id')->nullable()->after('address');
            });
        }

        $hasLegacyZoneColumn = Schema::hasColumn('addresses', 'zone');

        $addresses = DB::table('addresses')
            ->select(['addresses.id', 'addresses.company_id', 'companies.country_id'])
            ->when($hasLegacyZoneColumn, function ($query) {
                $query->addSelect('addresses.zone');
            })
            ->join('companies', 'companies.id', '=', 'addresses.company_id')
            ->get();

        foreach ($addresses as $address) {
            if (! is_numeric($address->country_id)) {
                continue;
            }

            $countryId = (int) $address->country_id;
            $zoneId = null;

            if ($hasLegacyZoneColumn && is_string($address->zone) && $address->zone !== '') {
                $zoneId = DB::table('zones')
                    ->where('country_id', $countryId)
                    ->where('name', $address->zone)
                    ->value('id');
            }

            if ($zoneId === null) {
                $zoneId = DB::table('zones')
                    ->where('country_id', $countryId)
                    ->orderBy('id')
                    ->value('id');
            }

            if ($zoneId !== null) {
                DB::table('addresses')->where('id', $address->id)->update(['zone_id' => $zoneId]);
            }
        }

        DB::table('addresses')->whereNull('zone_id')->orWhere('zone_id', 0)->delete();

        if ($hasLegacyZoneColumn) {
            Schema::table('addresses', function (Blueprint $table) {
                $table->dropColumn('zone');
            });
        }

        Schema::table('addresses', function (Blueprint $table) {
            $table->unsignedBigInteger('zone_id')->nullable(false)->change();
        });

        $this->addZoneForeignKeyIfMissing();
    }

    public function down(): void
    {
        Schema::table('addresses', function (Blueprint $table) {
            $table->dropForeign(['zone_id']);
        });

        Schema::table('addresses', function (Blueprint $table) {
            $table->string('zone')->nullable()->after('address');
        });

        $rows = DB::table('addresses')
            ->select(['addresses.id', 'zones.name'])
            ->join('zones', 'zones.id', '=', 'addresses.zone_id')
            ->get();

        foreach ($rows as $row) {
            DB::table('addresses')->where('id', $row->id)->update(['zone' => $row->name]);
        }

        Schema::table('addresses', function (Blueprint $table) {
            $table->dropColumn('zone_id');
        });

        Schema::table('addresses', function (Blueprint $table) {
            $table->string('zone')->nullable(false)->change();
        });
    }

    private function addZoneForeignKeyIfMissing(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            $exists = DB::selectOne(
                'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = ?',
                ['addresses', 'addresses_zone_id_foreign', 'FOREIGN KEY'],
            );

            if ($exists !== null) {
                return;
            }
        }

        Schema::table('addresses', function (Blueprint $table) {
            $table->foreign('zone_id')->references('id')->on('zones')->restrictOnDelete();
        });
    }
};
