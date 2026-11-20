<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CheckCompanyUniquenessRequest;
use App\Services\CompanyDomainService;
use Illuminate\Http\JsonResponse;

class CheckCompanyUniquenessController extends Controller
{
    public function __construct(
        private readonly CompanyDomainService $domains,
    ) {}

    public function __invoke(CheckCompanyUniquenessRequest $request): JsonResponse
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
