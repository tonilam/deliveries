<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use Illuminate\Http\JsonResponse;

class ShowCompanyController extends Controller
{
    public function __invoke(Company $company): JsonResponse
    {
        return response()->json([
            'company' => $company,
        ]);
    }
}
