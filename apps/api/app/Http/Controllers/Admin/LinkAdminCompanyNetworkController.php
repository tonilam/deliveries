<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LinkAdminCompanyNetworkRequest;
use App\Models\Company;
use Illuminate\Http\JsonResponse;

class LinkAdminCompanyNetworkController extends Controller
{
    public function __invoke(LinkAdminCompanyNetworkRequest $request, Company $company): JsonResponse
    {
        $child = Company::query()->findOrFail($request->childCompanyId());

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
}
