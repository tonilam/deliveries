<?php

namespace Tests\Feature;

use App\Enums\CompanyType;
use App\Enums\LoadType;
use App\Models\Address;
use App\Models\Company;
use App\Models\Load;
use Carbon\Carbon;
use Database\Seeders\LoadSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoadSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_weekday_loads_with_items_and_child_variants(): void
    {
        $owner = Company::factory()->create(['company_type' => CompanyType::Broker]);
        Company::factory()->forNetworkOf($owner, CompanyType::Customer)->create();
        Company::factory()->forNetworkOf($owner, CompanyType::Provider)->create();
        Company::factory()->forNetworkOf($owner, CompanyType::Provider)->create();
        Address::factory()->for($owner)->collection()->create();
        Address::factory()->for($owner)->delivery()->count(5)->create();

        $weekStart = now()->startOfWeek(Carbon::MONDAY)->startOfDay();
        $weekEnd = $weekStart->copy()->addDays(4);

        $seeder = new LoadSeeder;
        $seeder->setContainer($this->app);
        $seeder->run(12, $owner->id);

        $parents = Load::query()->whereNull('parent_load_id')->get();
        $this->assertCount(12, $parents);

        $allLoads = Load::query()->with('items')->get();
        foreach ($allLoads as $load) {
            $this->assertGreaterThanOrEqual(1, $load->items->count());
            $this->assertLessThanOrEqual(5, $load->items->count());
            $pickup = $load->pickup_date;
            $dropoff = $load->dropoff_date;
            $this->assertTrue($pickup->betweenIncluded($weekStart, $weekEnd));
            $this->assertTrue($dropoff->betweenIncluded($weekStart, $weekEnd));
            $this->assertGreaterThanOrEqual(1, $pickup->dayOfWeekIso);
            $this->assertLessThanOrEqual(5, $pickup->dayOfWeekIso);
            $this->assertGreaterThanOrEqual(1, $dropoff->dayOfWeekIso);
            $this->assertLessThanOrEqual(5, $dropoff->dayOfWeekIso);
        }

        $this->assertTrue(
            Load::query()->where('type', LoadType::AddDrop)->exists(),
        );
        $this->assertTrue(
            Load::query()->where('type', LoadType::XDock)->exists(),
        );
    }
}
