<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListNetworkCompaniesRequest;
use App\Models\Company;
use App\Services\CompanyTypeService;
use App\Services\NetworkCompanyListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class NetworkCompanyListController extends Controller
{
    public function __construct(
        private readonly CompanyTypeService $companyTypes,
        private readonly NetworkCompanyListQuery $listQuery,
    ) {}

    public function __invoke(ListNetworkCompaniesRequest $request): JsonResponse
    {
        $parent = $request->ownCompany();
        $parentType = $this->companyTypes->resolveType($parent);
        $networkType = $request->networkType();

        if (! $parentType->allowsNetworkTab($networkType)) {
            throw ValidationException::withMessages([
                'network_type' => ['This network tab is not available for your company type.'],
            ]);
        }

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
            'own_company_type' => $parentType->value,
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
