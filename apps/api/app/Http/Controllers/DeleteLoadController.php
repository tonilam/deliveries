<?php

namespace App\Http\Controllers;

use App\Enums\LoadType;
use App\Http\Requests\ManageLoadRequest;
use App\Models\Load;
use App\Services\LoadActivityLogger;
use Illuminate\Http\JsonResponse;

class DeleteLoadController extends Controller
{
    public function __invoke(ManageLoadRequest $request, Load $load, LoadActivityLogger $activityLogger): JsonResponse
    {
        $user = $request->user();

        if ($load->type === LoadType::Direct) {
            foreach ($load->children()->get() as $child) {
                $activityLogger->deleted($child, $user);
            }
        }

        $activityLogger->deleted($load, $user);

        if ($load->type === LoadType::Direct) {
            $load->children()->delete();
        }

        $load->delete();

        return response()->json(['deleted' => true]);
    }
}
