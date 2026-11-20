<?php

namespace App\Http\Controllers\Admin;

use App\Enums\FeatureKey;
use App\Http\Controllers\Controller;
use App\Services\FeatureService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UpdateFeatureController extends Controller
{
    public function __construct(
        private readonly FeatureService $features,
    ) {}

    public function __invoke(Request $request, string $key): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        if (FeatureKey::tryFrom($key) === null) {
            throw new NotFoundHttpException('Unknown feature.');
        }

        try {
            $feature = $this->features->setEnabled($key, (bool) $validated['enabled']);
        } catch (InvalidArgumentException) {
            throw new NotFoundHttpException('Unknown feature.');
        }

        return response()->json([
            'feature' => $feature,
        ]);
    }
}
