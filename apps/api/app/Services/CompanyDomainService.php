<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanyAllowedDomain;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CompanyDomainService
{
    public function emailDomain(string $email): ?string
    {
        $email = strtolower(trim($email));
        $at = strrpos($email, '@');

        if ($at === false || $at === strlen($email) - 1) {
            return null;
        }

        return substr($email, $at + 1);
    }

    /**
     * @param  list<string|mixed>  $domains
     * @return list<string>
     */
    public function normalizeDomains(array $domains): array
    {
        $normalized = [];

        foreach ($domains as $domain) {
            if (! is_string($domain)) {
                continue;
            }

            $domain = strtolower(trim($domain));
            $domain = ltrim($domain, '@');
            $domain = rtrim($domain, '.');

            if ($domain === '') {
                continue;
            }

            $normalized[] = $domain;
        }

        return array_values(array_unique($normalized));
    }

    /**
     * @return Collection<int, Company>
     */
    public function companiesMatchingEmail(string $email): Collection
    {
        $domain = $this->emailDomain($email);

        if ($domain === null) {
            return collect();
        }

        $companyIds = CompanyAllowedDomain::query()
            ->where('domain', $domain)
            ->pluck('company_id');

        if ($companyIds->isEmpty()) {
            return collect();
        }

        return Company::query()
            ->whereIn('id', $companyIds)
            ->orderBy('business_name')
            ->get();
    }

    /**
     * @param  list<string>  $domains
     */
    public function assertDomainsValid(array $domains): void
    {
        $domains = $this->normalizeDomains($domains);

        if ($domains === []) {
            throw ValidationException::withMessages([
                'allowed_domains' => ['Add at least one allowed email domain.'],
            ]);
        }

        foreach ($domains as $domain) {
            if (! preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $domain)) {
                throw ValidationException::withMessages([
                    'allowed_domains' => ["Invalid domain: {$domain}."],
                ]);
            }
        }
    }

    public function normalizeRegNumber(string $regNumber): string
    {
        return preg_replace('/\s+/', '', trim($regNumber)) ?? trim($regNumber);
    }

    public function normalizeBusinessName(string $businessName): string
    {
        return preg_replace('/\s+/', ' ', trim($businessName)) ?? trim($businessName);
    }

    /**
     * Per-field uniqueness check for company identity fields.
     *
     * @param  list<string>  $domains
     * @return array{
     *     ok: bool,
     *     fields: array{
     *         business_name: array{ok: bool, message: string|null},
     *         reg_number: array{ok: bool, message: string|null},
     *         allowed_domains: array{ok: bool, message: string|null}
     *     }
     * }
     */
    public function checkCompanyIdentity(
        string $regNumber,
        string $businessName,
        array $domains,
        ?int $exceptCompanyId = null,
    ): array {
        $regNumber = $this->normalizeRegNumber($regNumber);
        $businessName = $this->normalizeBusinessName($businessName);
        $domains = $this->normalizeDomains($domains);

        $fields = [
            'business_name' => ['ok' => true, 'message' => null],
            'reg_number' => ['ok' => true, 'message' => null],
            'allowed_domains' => ['ok' => true, 'message' => null],
        ];

        if ($domains === []) {
            $fields['allowed_domains'] = [
                'ok' => false,
                'message' => 'Add at least one allowed email domain.',
            ];
        } else {
            foreach ($domains as $domain) {
                if (! preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $domain)) {
                    $fields['allowed_domains'] = [
                        'ok' => false,
                        'message' => "Invalid domain: {$domain}.",
                    ];
                    break;
                }
            }
        }

        // Compare via PHP normalization so whitespace/case rules match create/update writes.
        $others = Company::query()
            ->when($exceptCompanyId !== null, fn ($q) => $q->where('id', '!=', $exceptCompanyId))
            ->get(['id', 'reg_number', 'business_name']);

        $regConflict = $others->contains(
            fn (Company $c): bool => $this->normalizeRegNumber($c->reg_number) === $regNumber,
        );

        if ($regConflict) {
            $fields['reg_number'] = [
                'ok' => false,
                'message' => 'This registration number is already used by another company.',
            ];
        }

        $nameConflict = $others->contains(
            fn (Company $c): bool => strcasecmp(
                $this->normalizeBusinessName($c->business_name),
                $businessName,
            ) === 0,
        );

        if ($nameConflict) {
            $fields['business_name'] = [
                'ok' => false,
                'message' => 'This business name is already used by another company.',
            ];
        }

        if ($fields['allowed_domains']['ok']) {
            $domainConflict = CompanyAllowedDomain::query()
                ->whereIn('domain', $domains)
                ->when($exceptCompanyId !== null, fn ($q) => $q->where('company_id', '!=', $exceptCompanyId))
                ->first();

            if ($domainConflict !== null) {
                $fields['allowed_domains'] = [
                    'ok' => false,
                    'message' => "Domain {$domainConflict->domain} is already used by another company.",
                ];
            }
        }

        return [
            'ok' => $fields['business_name']['ok']
                && $fields['reg_number']['ok']
                && $fields['allowed_domains']['ok'],
            'fields' => $fields,
        ];
    }

    /**
     * Enforce unique reg number, business name, and allowed domains across companies.
     *
     * @param  list<string>  $domains
     */
    public function assertCompanyIdentityUnique(
        string $regNumber,
        string $businessName,
        array $domains,
        ?int $exceptCompanyId = null,
    ): void {
        $result = $this->checkCompanyIdentity($regNumber, $businessName, $domains, $exceptCompanyId);

        if ($result['ok']) {
            return;
        }

        $messages = [];
        foreach ($result['fields'] as $field => $status) {
            if (! $status['ok'] && is_string($status['message'])) {
                $messages[$field] = [$status['message']];
            }
        }

        throw ValidationException::withMessages($messages);
    }

    /**
     * Persist domains on the company JSON column and unique domain rows.
     *
     * @param  list<string>  $domains
     */
    public function syncAllowedDomains(Company $company, array $domains): void
    {
        $domains = $this->normalizeDomains($domains);
        $this->assertDomainsValid($domains);

        try {
            $company->allowedDomainRows()->delete();

            foreach ($domains as $domain) {
                $company->allowedDomainRows()->create(['domain' => $domain]);
            }

            $company->forceFill(['allowed_domains' => $domains])->save();
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                throw ValidationException::withMessages([
                    'allowed_domains' => ['One or more domains are already used by another company.'],
                ]);
            }

            throw $e;
        }
    }

    public function assertEmailAllowedForCompany(string $email, Company $company): void
    {
        $domain = $this->emailDomain($email);
        $allowed = $company->allowedDomainRows()->pluck('domain')->all();

        if ($domain === null || ! in_array($domain, $allowed, true)) {
            throw ValidationException::withMessages([
                'email' => ['This email domain is not allowed for the selected company.'],
            ]);
        }
    }

    /**
     * Resolve which company a customer may join for the given email.
     *
     * @throws ValidationException when no match, invalid selection, or multiple matches without company_id
     */
    public function resolveCompanyForEmail(string $email, ?int $companyId = null): Company
    {
        $matches = $this->companiesMatchingEmail($email);

        if ($matches->isEmpty()) {
            throw ValidationException::withMessages([
                'email' => ['No company accepts registrations from this email domain.'],
            ]);
        }

        if ($matches->count() === 1) {
            $company = $matches->first();

            if ($companyId !== null && $companyId !== $company->id) {
                throw ValidationException::withMessages([
                    'company_id' => ['The selected company does not match this email domain.'],
                ]);
            }

            return $company;
        }

        if ($companyId === null) {
            throw ValidationException::withMessages([
                'company_id' => ['Select which company to join.'],
            ]);
        }

        $company = $matches->firstWhere('id', $companyId);

        if ($company === null) {
            throw ValidationException::withMessages([
                'company_id' => ['The selected company does not match this email domain.'],
            ]);
        }

        return $company;
    }

    /**
     * @return list<array{id: int, business_name: string}>
     */
    public function companyChoicesForEmail(string $email): array
    {
        return $this->companiesMatchingEmail($email)
            ->map(fn (Company $c): array => [
                'id' => $c->id,
                'business_name' => $c->business_name,
            ])
            ->all();
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $sqlState = $e->errorInfo[0] ?? null;
        $driverCode = $e->errorInfo[1] ?? null;

        return $sqlState === '23000' || $driverCode === 1062 || $driverCode === 19;
    }
}
