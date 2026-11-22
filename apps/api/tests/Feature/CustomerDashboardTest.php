<?php

namespace Tests\Feature;

use App\Enums\CompanyType;
use App\Enums\LoadType;
use App\Models\Address;
use App\Models\Company;
use App\Models\Load;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_guest_cannot_view_customer_dashboard(): void
    {
        $this->asSpa()->getJson('/api/dashboard')->assertUnauthorized();
    }

    public function test_admin_cannot_view_customer_dashboard(): void
    {
        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/dashboard')->assertForbidden();
    }

    public function test_broker_dashboard_returns_both_rankings_and_week_counts(): void
    {
        CarbonImmutable::setTestNow('2026-11-22 12:00:00');

        [$owner, $customer, $provider, $collection, $delivery, $user] = $this->brokerFixture();
        $providerB = Company::factory()->forNetworkOf($owner, CompanyType::Provider)->create([
            'business_name' => 'Beta Haulage',
        ]);
        $customerB = Company::factory()->forNetworkOf($owner, CompanyType::Customer)->create([
            'business_name' => 'Acme Retail',
        ]);

        $thisWeek = CarbonImmutable::parse('2026-11-20', 'UTC');
        $nextWeek = CarbonImmutable::parse('2026-11-25', 'UTC');

        Load::query()->create($this->loadAttributes($owner, $customer, $provider, $collection, $delivery, $thisWeek));
        Load::query()->create($this->loadAttributes($owner, $customer, $provider, $collection, $delivery, $thisWeek));
        Load::query()->create($this->loadAttributes($owner, $customerB, $provider, $collection, $delivery, $nextWeek));
        Load::query()->create($this->loadAttributes($owner, $customer, $providerB, $collection, $delivery, $nextWeek));

        $this->loginAs($user);

        $this->asSpa()->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('company_type', 'broker')
            ->assertJsonCount(2, 'top_customers')
            ->assertJsonPath('top_customers.0.business_name', $customer->business_name)
            ->assertJsonPath('top_customers.0.load_count', 3)
            ->assertJsonCount(2, 'top_providers')
            ->assertJsonPath('top_providers.0.load_count', 3)
            ->assertJsonFragment(['pickup_date' => '2026-11-20', 'count' => 2])
            ->assertJsonFragment(['pickup_date' => '2026-11-25', 'count' => 2])
            ->assertJsonCount(14, 'loads_by_date');
    }

    public function test_customer_company_sees_providers_only(): void
    {
        CarbonImmutable::setTestNow('2026-11-22 12:00:00');

        $owner = Company::factory()->create(['company_type' => CompanyType::Customer]);
        $provider = Company::factory()->forNetworkOf($owner, CompanyType::Provider)->create();
        $collection = Address::factory()->for($owner)->collection()->create();
        $delivery = Address::factory()->for($owner)->delivery()->create();
        $user = User::factory()->forCompany($owner)->create([
            'email' => 'cust@example.com',
            'password' => 'Password1!',
        ]);

        Load::query()->create($this->loadAttributes(
            $owner,
            $owner,
            $provider,
            $collection,
            $delivery,
            CarbonImmutable::parse('2026-11-20', 'UTC'),
        ));

        $this->loginAs($user);

        $this->asSpa()->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('company_type', 'customer')
            ->assertJsonCount(0, 'top_customers')
            ->assertJsonCount(1, 'top_providers');
    }

    public function test_child_loads_are_excluded_from_counts(): void
    {
        CarbonImmutable::setTestNow('2026-11-22 12:00:00');

        [$owner, $customer, $provider, $collection, $delivery, $user] = $this->brokerFixture();
        $thisWeek = CarbonImmutable::parse('2026-11-20', 'UTC');

        $parent = Load::query()->create($this->loadAttributes(
            $owner,
            $customer,
            $provider,
            $collection,
            $delivery,
            $thisWeek,
        ));

        Load::query()->create([
            ...$this->loadAttributes($owner, $customer, $provider, $collection, $delivery, $thisWeek),
            'parent_load_id' => $parent->id,
            'type' => LoadType::AddDrop,
        ]);
        Load::query()->create([
            ...$this->loadAttributes($owner, $customer, $provider, $collection, $delivery, $thisWeek),
            'parent_load_id' => $parent->id,
            'type' => LoadType::XDock,
        ]);

        $this->loginAs($user);

        $this->asSpa()->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('top_customers.0.load_count', 1)
            ->assertJsonPath('top_providers.0.load_count', 1)
            ->assertJsonFragment(['pickup_date' => '2026-11-20', 'count' => 1]);
    }

    public function test_provider_company_sees_customers_only(): void
    {
        CarbonImmutable::setTestNow('2026-11-22 12:00:00');

        $owner = Company::factory()->create(['company_type' => CompanyType::Provider]);
        $customer = Company::factory()->forNetworkOf($owner, CompanyType::Customer)->create();
        $collection = Address::factory()->for($owner)->collection()->create();
        $delivery = Address::factory()->for($owner)->delivery()->create();
        $user = User::factory()->forCompany($owner)->create([
            'email' => 'prov@example.com',
            'password' => 'Password1!',
        ]);

        Load::query()->create($this->loadAttributes(
            $owner,
            $customer,
            $owner,
            $collection,
            $delivery,
            CarbonImmutable::parse('2026-11-25', 'UTC'),
        ));

        $this->loginAs($user);

        $this->asSpa()->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('company_type', 'provider')
            ->assertJsonCount(1, 'top_customers')
            ->assertJsonCount(0, 'top_providers');
    }

    /**
     * @return array{0: Company, 1: Company, 2: Company, 3: Address, 4: Address, 5: User}
     */
    private function brokerFixture(): array
    {
        $owner = Company::factory()->create(['company_type' => CompanyType::Broker]);
        $customer = Company::factory()->forNetworkOf($owner, CompanyType::Customer)->create();
        $provider = Company::factory()->forNetworkOf($owner, CompanyType::Provider)->create();
        $collection = Address::factory()->for($owner)->collection()->create();
        $delivery = Address::factory()->for($owner)->delivery()->create();
        $user = User::factory()->forCompany($owner)->create([
            'email' => 'broker@example.com',
            'password' => 'Password1!',
        ]);

        return [$owner, $customer, $provider, $collection, $delivery, $user];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadAttributes(
        Company $owner,
        Company $customer,
        Company $provider,
        Address $collection,
        Address $delivery,
        CarbonImmutable $pickupDate,
    ): array {
        return [
            'company_id' => $owner->id,
            'type' => LoadType::Direct,
            'parent_load_id' => null,
            'customer_company_id' => $customer->id,
            'provider_company_id' => $provider->id,
            'collection_address_id' => $collection->id,
            'delivery_address_id' => $delivery->id,
            'pallet_count' => 1,
            'pickup_date' => $pickupDate->toDateString(),
            'pickup_time' => '08:00',
            'dropoff_date' => $pickupDate->addDay()->toDateString(),
            'dropoff_time' => '17:00',
        ];
    }

    private function loginAs(User $user): void
    {
        $this->asSpa()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password1!',
        ])->assertOk();
    }
}
