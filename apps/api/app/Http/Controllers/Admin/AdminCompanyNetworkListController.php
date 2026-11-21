<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListAdminCompanyNetworkRequest;
use App\Models\Company;
use App\Services\CompanyTypeService;
use App\Services\NetworkCompanyListQuery;
use Illuminate\Http\JsonResponse;

class AdminCompanyNetworkListController extends Controller
{
    public function __construct(
        private readonly CompanyTypeService $companyTypes,
        private readonly NetworkCompanyListQuery $listQuery,
    ) {}

    public function __invoke(ListAdminCompanyNetworkRequest $request, Company $company): JsonResponse
    {
        $networkType = $request->networkType();
        $this->companyTypes->assertAdminNetworkListAllowed($company, $networkType);

        $parent = $company;
        $parentType = $this->companyTypes->resolveType($parent);
        $query = Company::query()
            ->where('parent_company_id', $parent->id)
            ->where('company_type', $networkType->value);

        $this->listQuery->applyFilters($query, $request->filters());
        $this->listQuery->applySearch($query, $request->search());
        $this->listQuery->applySort($query, $request->sort(), $request->direction());

        $perPage = $request->perPage();
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);

        $paginator = $query
            ->with(['country' => static fn ($q) => $q->select('id', 'name', 'code')])
            ->withCount('addresses')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();

        return response()->json([
            'companies' => collect($paginator->items())
                ->map(static fn (Company $company) => $company->toAdminPayload())
                ->values()
                ->all(),
            'parent_company_type' => $parentType->value,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }
}
