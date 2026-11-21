<?php

namespace App\Http\Controllers;

use App\Http\Requests\DeleteNetworkCompanyRequest;
use App\Models\Company;
use App\Services\CompanyTypeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DeleteNetworkCompanyController extends Controller
{
    public function __construct(
        private readonly CompanyTypeService $companyTypes,
    ) {}

    public function __invoke(DeleteNetworkCompanyRequest $request, Company $company): JsonResponse
    {
        $reason = $this->companyTypes->companyCanDelete($company);
        if ($reason !== null) {
            return response()->json([
                'message' => $reason,
            ], 422);
        }

        DB::transaction(function () use ($company): void {
            $company->allowedDomainRows()->delete();
            $company->delete();
        });

        return response()->json(['ok' => true]);
    }
}
