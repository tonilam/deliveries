<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Company;
use Illuminate\Http\JsonResponse;

class CompanyListController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $companies = Company::query()
            ->orderBy('business_name')
            ->get();

        return response()->json([
            'companies' => $companies,
        ]);
    }
}
