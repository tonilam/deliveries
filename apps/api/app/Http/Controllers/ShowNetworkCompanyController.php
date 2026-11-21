<?php

namespace App\Http\Controllers;

use App\Http\Requests\ShowNetworkCompanyRequest;
use App\Models\Company;
use Illuminate\Http\JsonResponse;

class ShowNetworkCompanyController extends Controller
{
    public function __invoke(ShowNetworkCompanyRequest $request, Company $company): JsonResponse
    {
        $request->assertNetworkCompanyAccessible($company);

        return response()->json([
            'company' => $company->fresh()?->toAdminPayload(),
        ]);
    }
}
