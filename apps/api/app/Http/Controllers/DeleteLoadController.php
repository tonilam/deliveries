<?php

namespace App\Http\Controllers;

use App\Enums\LoadType;
use App\Http\Requests\ManageLoadRequest;
use App\Models\Load;
use Illuminate\Http\JsonResponse;

class DeleteLoadController extends Controller
{
    public function __invoke(ManageLoadRequest $request, Load $load): JsonResponse
    {
        if ($load->type === LoadType::Direct) {
            $load->children()->delete();
        }

        $load->delete();

        return response()->json(['deleted' => true]);
    }
}
