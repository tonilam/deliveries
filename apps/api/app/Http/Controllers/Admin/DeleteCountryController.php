<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRequest;
use App\Models\Country;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class DeleteCountryController extends Controller
{
    public function __invoke(AdminRequest $request, Country $country): Response|JsonResponse
    {
        if ($country->companies()->exists()) {
            throw ValidationException::withMessages([
                'country' => ['This country cannot be deleted while companies still use it.'],
            ]);
        }

        if ($country->zones()->withTrashed()->exists()) {
            throw ValidationException::withMessages([
                'country' => ['This country cannot be deleted while zones still belong to it.'],
            ]);
        }

        $country->delete();

        return response()->noContent();
    }
}
