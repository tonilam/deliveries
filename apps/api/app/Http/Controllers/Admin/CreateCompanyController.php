<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCompanyRequest;
use App\Models\Company;
use App\Services\CompanyDomainService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateCompanyController extends Controller
{
    public function __construct(
        private readonly CompanyDomainService $domains,
    ) {}

    public function __invoke(StoreCompanyRequest $request): JsonResponse
    {
        $domains = $this->domains->normalizeDomains($request->input('allowed_domains', []));
        $regNumber = $this->domains->normalizeRegNumber($request->string('reg_number')->toString());
        $businessName = $this->domains->normalizeBusinessName($request->string('business_name')->toString());

        $this->domains->assertCompanyIdentityUnique($regNumber, $businessName, $domains);

        try {
            $company = DB::transaction(function () use ($request, $domains, $regNumber, $businessName): Company {
                $company = Company::query()->create([
                    'reg_number' => $regNumber,
                    'reg_type' => $request->string('reg_type')->toString(),
                    'business_name' => $businessName,
                    'invoicee_name' => $request->string('invoicee_name')->toString(),
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
            'company' => $company,
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
