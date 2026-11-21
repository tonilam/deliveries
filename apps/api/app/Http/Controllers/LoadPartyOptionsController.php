<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoadPartyOptionsRequest;
use App\Models\Company;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class LoadPartyOptionsController extends Controller
{
    public function __invoke(LoadPartyOptionsRequest $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $partyType = $request->partyType();
        $search = $request->queryText();
        $useSearch = $search !== null && strlen($search) >= 2;

        $query = Company::query()
            ->select('id', 'business_name')
            ->where('parent_company_id', $companyId)
            ->where('company_type', $partyType->value)
            ->orderBy('business_name')
            ->limit($useSearch ? 200 : 10);

        if ($useSearch) {
            $like = '%'.$this->escapeLike($search).'%';
            $query->where(function (Builder $inner) use ($like): void {
                $inner->where('business_name', 'like', $like);
            });
        }

        $companies = $query->get()
            ->map(static fn (Company $company) => [
                'id' => $company->id,
                'business_name' => $company->business_name,
            ])
            ->values()
            ->all();

        return response()->json(['companies' => $companies]);
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
