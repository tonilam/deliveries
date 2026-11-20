<?php

namespace App\Http\Controllers;

use App\Services\CompanyDomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RegistrationCompaniesController extends Controller
{
    public function __construct(
        private readonly CompanyDomainService $domains,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);

        return response()->json([
            'companies' => $this->domains->companyChoicesForEmail($validated['email']),
        ]);
    }
}
