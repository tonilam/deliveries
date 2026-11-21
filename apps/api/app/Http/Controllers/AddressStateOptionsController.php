<?php

namespace App\Http\Controllers;

use App\Http\Requests\AddressStateOptionsRequest;
use App\Models\Company;
use Illuminate\Http\JsonResponse;

class AddressStateOptionsController extends Controller
{
    public function __invoke(AddressStateOptionsRequest $request): JsonResponse
    {
        /** @var Company|null $company */
        $company = Company::query()
            ->with(['country.states' => static fn ($query) => $query->orderBy('name')])
            ->find($request->user()->company_id);

        if ($company === null || $company->country === null) {
            return response()->json([
                'states' => [],
            ]);
        }

        $states = $company->country->states
            ->map(static fn ($state) => [
                'code' => $state->code,
                'name' => $state->name,
            ])
            ->values()
            ->all();

        return response()->json([
            'states' => $states,
        ]);
    }
}
