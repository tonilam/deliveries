<?php

namespace Tests\Feature\Auth;

use App\Models\Company;
use App\Services\CompanyDomainService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CompanyRegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_assigns_matching_company(): void
    {
        $company = Company::factory()->withDomains(['example.com'])->create();

        $this->asSpa()->postJson('/api/register', [
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])->assertCreated()
            ->assertJsonPath('user.company_id', $company->id);

        $this->assertDatabaseHas('users', [
            'email' => 'ada@example.com',
            'company_id' => $company->id,
        ]);
    }

    public function test_registration_rejects_unknown_email_domain(): void
    {
        Company::factory()->withDomains(['acme.test'])->create();

        $this->asSpa()->postJson('/api/register', [
            'name' => 'Ada',
            'email' => 'ada@unknown.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_registration_companies_lookup_returns_matches(): void
    {
        $company = Company::factory()->withDomains(['shared.test'])->create([
            'business_name' => 'Alpha',
        ]);

        $this->asSpa()->getJson('/api/registration/companies?email=ada@shared.test')
            ->assertOk()
            ->assertJsonCount(1, 'companies')
            ->assertJsonPath('companies.0.id', $company->id)
            ->assertJsonPath('companies.0.business_name', 'Alpha');
    }

    public function test_resolve_company_requires_choice_when_multiple_match(): void
    {
        $a = Company::factory()->withDomains(['alpha.test'])->create(['business_name' => 'Alpha']);
        $b = Company::factory()->withDomains(['beta.test'])->create(['business_name' => 'Beta']);

        // Simulate a multi-match response path (unique domains normally prevent this in storage).
        $service = $this->partialMock(CompanyDomainService::class, function ($mock) use ($a, $b): void {
            $mock->shouldReceive('companiesMatchingEmail')
                ->andReturn(collect([$a, $b]));
            $mock->shouldReceive('companyChoicesForEmail')
                ->andReturn([
                    ['id' => $a->id, 'business_name' => 'Alpha'],
                    ['id' => $b->id, 'business_name' => 'Beta'],
                ]);
            $mock->makePartial();
        });

        try {
            $service->resolveCompanyForEmail('ada@shared.test', null);
            $this->fail('Expected ValidationException');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('company_id', $e->errors());
        }

        $chosen = $service->resolveCompanyForEmail('ada@shared.test', $b->id);
        $this->assertTrue($chosen->is($b));
    }
}
