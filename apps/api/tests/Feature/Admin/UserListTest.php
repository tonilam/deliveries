<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserListTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_users(): void
    {
        $this->asSpa()->getJson('/api/admin/users?role=admin')->assertUnauthorized();
    }

    public function test_customer_cannot_list_users(): void
    {
        User::factory()->create([
            'email' => 'c@example.com',
            'password' => 'Password1!',
            'role' => UserRole::Customer,
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'c@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/users?role=customer')->assertForbidden();
    }

    public function test_admin_can_list_admin_users(): void
    {
        $admin = User::factory()->admin()->create([
            'name' => 'Ada Admin',
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ]);
        User::factory()->admin()->inactive()->create([
            'name' => 'Inactive Admin',
            'email' => 'inactive-admin@example.com',
        ]);
        User::factory()->create([
            'name' => 'Customer One',
            'email' => 'customer@example.com',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'ada@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/users?role=admin')
            ->assertOk()
            ->assertJsonCount(2, 'users')
            ->assertJsonFragment([
                'id' => $admin->id,
                'name' => 'Ada Admin',
                'email' => 'ada@example.com',
                'is_active' => true,
                'company' => null,
            ])
            ->assertJsonFragment([
                'name' => 'Inactive Admin',
                'email' => 'inactive-admin@example.com',
                'is_active' => false,
                'company' => null,
            ])
            ->assertJsonMissing(['email' => 'customer@example.com']);
    }

    public function test_admin_can_list_customer_users(): void
    {
        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);
        $company = Company::factory()->create([
            'business_name' => 'Acme Pty Ltd',
        ]);
        $customer = User::factory()->forCompany($company)->create([
            'name' => 'Casey Customer',
            'email' => 'casey@example.com',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/users?role=customer')
            ->assertOk()
            ->assertJsonCount(1, 'users')
            ->assertJsonPath('users.0.id', $customer->id)
            ->assertJsonPath('users.0.name', 'Casey Customer')
            ->assertJsonPath('users.0.company', 'Acme Pty Ltd')
            ->assertJsonPath('users.0.email', 'casey@example.com')
            ->assertJsonPath('users.0.is_active', true);
    }

    public function test_role_query_is_required_and_validated(): void
    {
        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();

        $this->asSpa()->getJson('/api/admin/users')->assertUnprocessable();
        $this->asSpa()->getJson('/api/admin/users?role=superuser')->assertUnprocessable();
    }

    public function test_admin_user_list_is_paginated(): void
    {
        $this->loginAsAdmin();

        User::factory()->admin()->count(29)->create();

        $default = $this->asSpa()->getJson('/api/admin/users?role=admin');
        $default->assertOk()
            ->assertJsonCount(25, 'users')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.per_page', 25)
            ->assertJsonPath('meta.total', 30)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.from', 1)
            ->assertJsonPath('meta.to', 25);

        $pageTwo = $this->asSpa()->getJson('/api/admin/users?role=admin&page=2&per_page=10');
        $pageTwo->assertOk()
            ->assertJsonCount(10, 'users')
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.total', 30)
            ->assertJsonPath('meta.from', 11)
            ->assertJsonPath('meta.to', 20);

        $this->asSpa()->getJson('/api/admin/users?role=admin&per_page=15')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);

        $this->asSpa()->getJson('/api/admin/users?role=admin&page=99&per_page=10')
            ->assertOk()
            ->assertJsonPath('meta.current_page', 3)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonCount(10, 'users');
    }

    public function test_admin_user_list_supports_server_side_filters(): void
    {
        $this->loginAsAdmin();

        $alpha = Company::factory()->create(['business_name' => 'Alpha Logistics']);
        $beta = Company::factory()->create(['business_name' => 'Beta Freight']);

        User::factory()->forCompany($alpha)->create([
            'name' => 'Alice Active',
            'email' => 'alice@alpha.test',
            'is_active' => true,
        ]);
        User::factory()->forCompany($beta)->inactive()->create([
            'name' => 'Bob Beta',
            'email' => 'bob@beta.test',
        ]);

        $this->asSpa()->getJson('/api/admin/users?'.http_build_query([
            'role' => 'customer',
            'filter' => [
                'name' => [
                    'type' => 'contains',
                    'filter' => 'Alice',
                ],
            ],
        ]))->assertOk()
            ->assertJsonCount(1, 'users')
            ->assertJsonPath('users.0.name', 'Alice Active')
            ->assertJsonPath('meta.total', 1);

        $this->asSpa()->getJson('/api/admin/users?'.http_build_query([
            'role' => 'customer',
            'filter' => [
                'company' => [
                    'type' => 'contains',
                    'filter' => 'Beta',
                ],
            ],
        ]))->assertOk()
            ->assertJsonCount(1, 'users')
            ->assertJsonPath('users.0.company', 'Beta Freight')
            ->assertJsonPath('meta.total', 1);

        $this->asSpa()->getJson('/api/admin/users?'.http_build_query([
            'role' => 'customer',
            'filter' => [
                'is_active' => [
                    'type' => 'equals',
                    'filter' => 'Yes',
                ],
            ],
        ]))->assertOk()
            ->assertJsonCount(1, 'users')
            ->assertJsonPath('users.0.email', 'alice@alpha.test');

        $this->asSpa()->getJson('/api/admin/users?'.http_build_query([
            'role' => 'customer',
            'filter' => [
                'name' => [
                    'type' => 'bogus',
                    'filter' => 'x',
                ],
            ],
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['filter.name.type']);
    }

    public function test_admin_user_list_supports_search(): void
    {
        $this->loginAsAdmin();

        $alpha = Company::factory()->create(['business_name' => 'Alpha Logistics']);
        $beta = Company::factory()->create(['business_name' => 'Beta Freight']);

        User::factory()->admin()->create([
            'name' => 'Ada Admin',
            'email' => 'ada@loadplanner.test',
        ]);
        User::factory()->forCompany($alpha)->create([
            'name' => 'Alice Active',
            'email' => 'alice@alpha.test',
        ]);
        User::factory()->forCompany($beta)->create([
            'name' => 'Bob Beta',
            'email' => 'bob@beta.test',
        ]);

        $this->asSpa()->getJson('/api/admin/users?role=admin&search=Ada')
            ->assertOk()
            ->assertJsonCount(1, 'users')
            ->assertJsonPath('users.0.name', 'Ada Admin')
            ->assertJsonPath('meta.total', 1);

        $this->asSpa()->getJson('/api/admin/users?role=customer&search=Alpha')
            ->assertOk()
            ->assertJsonCount(1, 'users')
            ->assertJsonPath('users.0.name', 'Alice Active');

        $this->asSpa()->getJson('/api/admin/users?role=customer&search=Yes')
            ->assertOk()
            ->assertJsonCount(2, 'users')
            ->assertJsonPath('meta.total', 2);
    }

    public function test_admin_user_list_supports_server_side_sorting(): void
    {
        $this->loginAsAdmin();

        $zeta = Company::factory()->create(['business_name' => 'Zulu Transport']);
        $alpha = Company::factory()->create(['business_name' => 'Alpha Logistics']);
        $mike = Company::factory()->create(['business_name' => 'Mike Haulage']);

        User::factory()->forCompany($zeta)->create([
            'name' => 'Zed User',
            'email' => 'z@example.test',
        ]);
        User::factory()->forCompany($alpha)->create([
            'name' => 'Amy User',
            'email' => 'a@example.test',
        ]);
        User::factory()->forCompany($mike)->create([
            'name' => 'Mike User',
            'email' => 'm@example.test',
        ]);

        $default = $this->asSpa()->getJson('/api/admin/users?role=customer');
        $default->assertOk()
            ->assertJsonPath('users.0.name', 'Amy User')
            ->assertJsonPath('users.1.name', 'Mike User')
            ->assertJsonPath('users.2.name', 'Zed User');

        $byNameDesc = $this->asSpa()->getJson('/api/admin/users?'.http_build_query([
            'role' => 'customer',
            'sort' => 'name',
            'direction' => 'desc',
        ]));
        $byNameDesc->assertOk()
            ->assertJsonPath('users.0.name', 'Zed User')
            ->assertJsonPath('users.2.name', 'Amy User');

        $byCompany = $this->asSpa()->getJson('/api/admin/users?'.http_build_query([
            'role' => 'customer',
            'sort' => 'company',
            'direction' => 'asc',
        ]));
        $byCompany->assertOk()
            ->assertJsonPath('users.0.company', 'Alpha Logistics')
            ->assertJsonPath('users.1.company', 'Mike Haulage')
            ->assertJsonPath('users.2.company', 'Zulu Transport');

        $this->asSpa()->getJson('/api/admin/users?'.http_build_query([
            'role' => 'customer',
            'sort' => 'not_a_column',
            'direction' => 'asc',
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['sort']);

        $this->asSpa()->getJson('/api/admin/users?'.http_build_query([
            'role' => 'admin',
            'sort' => 'company',
            'direction' => 'asc',
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['sort']);
    }

    private function loginAsAdmin(): void
    {
        User::factory()->admin()->create([
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ]);

        $this->asSpa()->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'Password1!',
        ])->assertOk();
    }
}
