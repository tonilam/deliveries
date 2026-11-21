<?php

namespace App\Http\Controllers;

use App\Http\Requests\RegistrationCompaniesRequest;
use App\Services\CompanyDomainService;
use Illuminate\Http\JsonResponse;

class RegistrationCompaniesController extends Controller
{
    public function __construct(
        private readonly CompanyDomainService $domains,
    ) {}

    public function __invoke(RegistrationCompaniesRequest $request): JsonResponse
    {
        return response()->json([
            'companies' => $this->domains->companyChoicesForEmail($request->string('email')->toString()),
        ]);
    }
}
