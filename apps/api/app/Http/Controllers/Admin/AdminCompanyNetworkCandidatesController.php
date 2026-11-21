<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListAdminCompanyNetworkCandidatesRequest;
use App\Models\Company;
use App\Services\CompanyTypeService;
use App\Services\NetworkCompanyListQuery;
use Illuminate\Http\JsonResponse;

class AdminCompanyNetworkCandidatesController extends Controller
{
    private const CANDIDATE_LIMIT = 25;

    public function __construct(
        private readonly CompanyTypeService $companyTypes,
        private readonly NetworkCompanyListQuery $listQuery,
    ) {}

    public function __invoke(ListAdminCompanyNetworkCandidatesRequest $request, Company $company): JsonResponse
    {
        $networkType = $request->networkType();
        $this->companyTypes->assertAdminNetworkListAllowed($company, $networkType);

        $parent = $company;

        $query = Company::query()
            ->whereNull('parent_company_id')
            ->where('company_type', $networkType->value)
            ->where('id', '!=', $parent->id)
            ->whereDoesntHave('children')
            ->orderBy('business_name')
            ->orderBy('id');

        $this->listQuery->applySearch($query, $request->search());

        $companies = $query
            ->limit(self::CANDIDATE_LIMIT)
            ->get(['id', 'business_name', 'reg_number', 'email'])
            ->map(static fn (Company $company): array => [
                'id' => $company->id,
                'business_name' => $company->business_name,
                'reg_number' => $company->reg_number,
                'email' => $company->email,
            ])
            ->values()
            ->all();

        return response()->json([
            'companies' => $companies,
        ]);
    }
}
