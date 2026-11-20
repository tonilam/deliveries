<?php

namespace App\Http\Controllers;

use App\Services\FeatureService;
use Illuminate\Http\JsonResponse;

class FeatureFlagsController extends Controller
{
    public function __construct(
        private readonly FeatureService $features,
    ) {}

    public function __invoke(): JsonResponse
    {
        return response()->json([
            'features' => $this->features->publicFlags(),
        ]);
    }
}
