<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateNetworkCompanyRequest;
use App\Models\Company;
use App\Services\CompanyDomainService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateNetworkCompanyController extends Controller
{
    public function __construct(
        private readonly CompanyDomainService $domains,
    ) {}

    public function __invoke(UpdateNetworkCompanyRequest $request, Company $company): JsonResponse
    {
        $request->assertNetworkCompanyAccessible($company);

        $domains = $this->domains->normalizeDomains($request->input('allowed_domains', []));
        $regNumber = $this->domains->normalizeRegNumber($request->string('reg_number')->toString());
        $businessName = $this->domains->normalizeBusinessName($request->string('business_name')->toString());
        $countryId = $request->integer('country_id');

        if ($countryId !== (int) $company->country_id && $company->addresses()->exists()) {
            throw ValidationException::withMessages([
                'country_id' => ['Country cannot be changed while this company has addresses.'],
            ]);
        }

        $this->domains->assertCompanyIdentityUnique($regNumber, $businessName, $domains, $company->id);

        try {
            $company = DB::transaction(function () use ($request, $company, $domains, $regNumber, $businessName, $countryId): Company {
                $company->fill([
                    'country_id' => $countryId,
                    'reg_number' => $regNumber,
                    'reg_type' => $request->string('reg_type')->toString(),
                    'business_name' => $businessName,
                    'phone' => $request->string('phone')->toString(),
                    'email' => $request->string('email')->toString(),
                    'address' => $request->string('address')->toString(),
                ])->save();

                $this->domains->syncAllowedDomains($company, $domains);

                return $company->fresh();
            });
        } catch (QueryException $e) {
            $this->throwUniqueIdentityError($e);
            throw $e;
        }

        return response()->json([
            'company' => $company->toAdminPayload(),
        ]);
    }

    private function throwUniqueIdentityError(QueryException $e): void
    {
        $sqlState = $e->errorInfo[0] ?? null;
        $driverCode = $e->errorInfo[1] ?? null;
        $isUnique = $sqlState === '23000' || $driverCode === 1062 || $driverCode === 19;

        if (! $isUnique) {
            return;
        }

        $message = strtolower($e->getMessage());

        if (str_contains($message, 'reg_number')) {
            throw ValidationException::withMessages([
                'reg_number' => ['This registration number is already used by another company.'],
            ]);
        }

        if (str_contains($message, 'business_name')) {
            throw ValidationException::withMessages([
                'business_name' => ['This business name is already used by another company.'],
            ]);
        }

        throw ValidationException::withMessages([
            'allowed_domains' => ['One or more domains are already used by another company.'],
        ]);
    }
}
