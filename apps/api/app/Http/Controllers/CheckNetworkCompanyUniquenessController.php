<?php

namespace App\Http\Controllers;

use App\Http\Requests\CheckNetworkCompanyUniquenessRequest;
use App\Services\CompanyDomainService;
use Illuminate\Http\JsonResponse;

class CheckNetworkCompanyUniquenessController extends Controller
{
    public function __construct(
        private readonly CompanyDomainService $domains,
    ) {}

    public function __invoke(CheckNetworkCompanyUniquenessRequest $request): JsonResponse
    {
        $exceptId = $request->filled('company_id') ? $request->integer('company_id') : null;

        $result = $this->domains->checkCompanyIdentity(
            $request->string('reg_number')->toString(),
            $request->string('business_name')->toString(),
            $request->input('allowed_domains', []),
            $exceptId,
        );

        return response()->json($result);
    }
}
