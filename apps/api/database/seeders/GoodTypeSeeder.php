<?php

namespace Database\Seeders;

use App\Models\GoodType;
use Illuminate\Database\Seeder;

class GoodTypeSeeder extends Seeder
{
    /**
     * @var list<array{code: string, name: string, refrigerated_required: bool}>
     */
    private const ROWS = [
        ['code' => 'FRZ', 'name' => 'Frozen', 'refrigerated_required' => true],
        ['code' => 'CHL', 'name' => 'Chilled', 'refrigerated_required' => true],
        ['code' => 'DRY', 'name' => 'Dry', 'refrigerated_required' => false],
        ['code' => 'AMB', 'name' => 'Ambient', 'refrigerated_required' => false],
        ['code' => 'GEN', 'name' => 'General', 'refrigerated_required' => false],
    ];

    public function run(): void
    {
        foreach (self::ROWS as $row) {
            $type = GoodType::query()
                ->withTrashed()
                ->updateOrCreate(
                    ['code' => $row['code']],
                    [
                        'name' => $row['name'],
                        'refrigerated_required' => $row['refrigerated_required'],
                    ],
                );

            if ($type->trashed()) {
                $type->restore();
            }
        }

        $this->command?->info('Seeded '.count(self::ROWS).' goods types.');
    }
}
