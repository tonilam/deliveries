<?php

namespace App\Http\Controllers;

use App\Http\Requests\CustomerDashboardRequest;
use App\Models\Company;
use App\Services\CustomerDashboardService;
use Illuminate\Http\JsonResponse;

class CustomerDashboardController extends Controller
{
    public function __construct(
        private readonly CustomerDashboardService $dashboard,
    ) {}

    public function __invoke(CustomerDashboardRequest $request): JsonResponse
    {
        $companyId = $request->user()?->company_id;
        if ($companyId === null) {
            abort(403);
        }

        $owner = Company::query()->findOrFail($companyId);

        return response()->json($this->dashboard->stats($owner));
    }
}
