<?php

namespace App\Http\Controllers;

use App\Http\Requests\RateCardCompanyOptionsRequest;
use App\Models\Company;
use Illuminate\Http\JsonResponse;

class RateCardCompanyOptionsController extends Controller
{
    public function __invoke(RateCardCompanyOptionsRequest $request): JsonResponse
    {
        $query = $request->queryString();
        $ownCompanyId = $request->user()->company_id;
        $restrictionType = $request->restrictionType();

        $builder = Company::query()
            ->select(['id', 'business_name'])
            ->when($ownCompanyId !== null, function ($q) use ($ownCompanyId, $restrictionType) {
                $q->where('parent_company_id', $ownCompanyId)
                    ->where('company_type', $restrictionType->value);
            })
            ->orderBy('business_name')
            ->limit(200);

        if ($query !== null && strlen($query) >= 2) {
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $query);
            $builder->where('business_name', 'like', $escaped.'%');
        } elseif ($query !== null) {
            return response()->json(['companies' => []]);
        }

        $companies = $builder->get()
            ->map(static fn (Company $company) => [
                'id' => $company->id,
                'business_name' => $company->business_name,
            ])
            ->values()
            ->all();

        return response()->json(['companies' => $companies]);
    }
}
