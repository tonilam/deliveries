<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\CompanyTypeService;
use Illuminate\Http\JsonResponse;

class ShowCompanyController extends Controller
{
    public function __construct(
        private readonly CompanyTypeService $companyTypes,
    ) {}

    public function __invoke(Company $company): JsonResponse
    {
        return response()->json([
            'company' => [
                ...$company->toAdminPayload(),
                'blocked_root_company_types' => $this->companyTypes->blockedAdminRootCompanyTypes($company),
            ],
        ]);
    }
}
