<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateCompanyRequest;
use App\Models\Company;
use App\Services\CompanyDomainService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateCompanyController extends Controller
{
    public function __construct(
        private readonly CompanyDomainService $domains,
    ) {}

    public function __invoke(UpdateCompanyRequest $request, Company $company): JsonResponse
    {
        if ($request->isFinanceOnly()) {
            return $this->updateFinance($request, $company);
        }

        return $this->updateDetails($request, $company);
    }

    private function updateFinance(UpdateCompanyRequest $request, Company $company): JsonResponse
    {
        $trackingOption = $request->input('tracking_option');
        $invoiceeName = $request->input('invoicee_name');

        $company->fill([
            'invoicee_name' => is_string($invoiceeName) ? trim($invoiceeName) : '',
            'gst_rate' => (float) $request->input('gst_rate'),
            'tracking_option' => is_string($trackingOption) && trim($trackingOption) !== ''
                ? trim($trackingOption)
                : null,
        ])->save();

        return response()->json([
            'company' => $company->fresh(),
        ]);
    }

    private function updateDetails(UpdateCompanyRequest $request, Company $company): JsonResponse
    {
        $domains = $this->domains->normalizeDomains($request->input('allowed_domains', []));
        $regNumber = $this->domains->normalizeRegNumber($request->string('reg_number')->toString());
        $businessName = $this->domains->normalizeBusinessName($request->string('business_name')->toString());

        $this->domains->assertCompanyIdentityUnique($regNumber, $businessName, $domains, $company->id);

        try {
            $company = DB::transaction(function () use ($request, $company, $domains, $regNumber, $businessName): Company {
                $company->fill([
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
            'company' => $company,
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
