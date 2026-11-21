<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreNetworkCompanyRequest;
use App\Models\Company;
use App\Services\CompanyDomainService;
use App\Services\CompanyTypeService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateNetworkCompanyController extends Controller
{
    public function __construct(
        private readonly CompanyDomainService $domains,
        private readonly CompanyTypeService $companyTypes,
    ) {}

    public function __invoke(StoreNetworkCompanyRequest $request): JsonResponse
    {
        $parent = $request->ownCompany();
        $parentType = $this->companyTypes->resolveType($parent);
        $networkType = $request->networkType();

        if (! $parentType->allowsNetworkTab($networkType)) {
            throw ValidationException::withMessages([
                'network_type' => ['This network tab is not available for your company type.'],
            ]);
        }

        $this->companyTypes->assertChildTypeAllowedForParent($parent, $networkType);

        $domains = $this->domains->normalizeDomains($request->input('allowed_domains', []));
        $regNumber = $this->domains->normalizeRegNumber($request->string('reg_number')->toString());
        $businessName = $this->domains->normalizeBusinessName($request->string('business_name')->toString());

        $this->domains->assertCompanyIdentityUnique($regNumber, $businessName, $domains);

        try {
            $company = DB::transaction(function () use ($request, $parent, $networkType, $domains, $regNumber, $businessName): Company {
                $company = Company::query()->create([
                    'country_id' => $request->integer('country_id'),
                    'company_type' => $networkType->value,
                    'parent_company_id' => $parent->id,
                    'reg_number' => $regNumber,
                    'reg_type' => $request->string('reg_type')->toString(),
                    'business_name' => $businessName,
                    'invoicee_name' => '',
                    'gst_rate' => 0.1,
                    'tracking_option' => null,
                    'phone' => $request->string('phone')->toString(),
                    'email' => $request->string('email')->toString(),
                    'address' => $request->string('address')->toString(),
                    'allowed_domains' => $domains,
                ]);

                $this->domains->syncAllowedDomains($company, $domains);

                return $company->fresh();
            });
        } catch (QueryException $e) {
            $this->throwUniqueIdentityError($e);
            throw $e;
        }

        return response()->json([
            'company' => $company->toAdminPayload(),
        ], 201);
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
