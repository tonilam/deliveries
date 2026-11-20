<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\FeatureService;
use Illuminate\Http\JsonResponse;

class FeatureListController extends Controller
{
    public function __construct(
        private readonly FeatureService $features,
    ) {}

    public function __invoke(): JsonResponse
    {
        return response()->json([
            'features' => $this->features->listForAdmin(),
        ]);
    }
}
