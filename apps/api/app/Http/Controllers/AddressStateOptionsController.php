<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Company;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddressStateOptionsController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null || $user->role !== UserRole::Customer || $user->company_id === null) {
            abort(403);
        }

        /** @var Company|null $company */
        $company = Company::query()
            ->with(['country.states' => static fn ($query) => $query->orderBy('name')])
            ->find($user->company_id);

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
