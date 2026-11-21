<?php

namespace App\Http\Controllers\Admin;

use App\Enums\CompanyType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LinkAdminCompanyNetworkRequest;
use App\Models\Company;
use App\Services\CompanyTypeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class LinkAdminCompanyNetworkController extends Controller
{
    public function __construct(
        private readonly CompanyTypeService $companyTypes,
    ) {}

    public function __invoke(LinkAdminCompanyNetworkRequest $request, Company $company): JsonResponse
    {
        $child = Company::query()->find($request->childCompanyId());

        $this->validate($company, $child);

        $child->update([
            'parent_company_id' => $company->id,
        ]);

        $child->load([
            'country' => static fn ($q) => $q->select('id', 'name', 'code'),
            'parent' => static fn ($q) => $q->select('id', 'business_name'),
        ]);
        $child->loadCount('addresses');

        return response()->json([
            'company' => $child->fresh()->toAdminPayload(),
        ]);
    }

    private function validate(Company $parent, ?Company $child): void
    {
        if ($child === null) {
            throw ValidationException::withMessages([
                'company_id' => ['Company not found.'],
            ]);
        }

        if ($parent->parent_company_id !== null) {
            throw ValidationException::withMessages([
                'company' => ['Only root companies can have a network.'],
            ]);
        }

        if ($child->id === $parent->id) {
            throw ValidationException::withMessages([
                'company_id' => ['A company cannot be linked to itself.'],
            ]);
        }

        if ($child->parent_company_id !== null) {
            throw ValidationException::withMessages([
                'company_id' => ['This company already belongs to a network.'],
            ]);
        }

        if ($child->children()->exists()) {
            throw ValidationException::withMessages([
                'company_id' => ['Companies with linked children cannot be moved into a network.'],
            ]);
        }

        $childType = $this->companyTypes->resolveType($child);
        if ($childType === CompanyType::Broker) {
            throw ValidationException::withMessages([
                'company_id' => ['Broker companies cannot be linked as network children.'],
            ]);
        }

        $this->companyTypes->assertChildTypeAllowedForParent($parent, $childType);
    }
}
