<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateFeatureRequest;
use App\Services\FeatureService;
use Illuminate\Http\JsonResponse;
use InvalidArgumentException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UpdateFeatureController extends Controller
{
    public function __construct(
        private readonly FeatureService $features,
    ) {}

    public function __invoke(UpdateFeatureRequest $request): JsonResponse
    {
        try {
            $feature = $this->features->setEnabled($request->featureKey(), $request->boolean('enabled'));
        } catch (InvalidArgumentException) {
            throw new NotFoundHttpException('Unknown feature.');
        }

        return response()->json([
            'feature' => $feature,
        ]);
    }
}
