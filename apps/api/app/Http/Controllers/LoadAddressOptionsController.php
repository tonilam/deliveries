<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoadAddressOptionsRequest;
use App\Models\Address;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class LoadAddressOptionsController extends Controller
{
    public function __invoke(LoadAddressOptionsRequest $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $addressType = $request->addressType();
        $search = $request->queryText();

        $query = Address::query()
            ->with('zone')
            ->where('company_id', $companyId)
            ->where('type', $addressType->value)
            ->orderBy('business_name')
            ->limit(200);

        if ($search !== null) {
            $like = '%'.$this->escapeLike($search).'%';
            $query->where(function (Builder $inner) use ($like): void {
                $inner->where('business_name', 'like', $like)
                    ->orWhere('address', 'like', $like)
                    ->orWhere('postcode', 'like', $like);
            });
        }

        $addresses = $query->get()
            ->map(static fn (Address $address) => [
                'id' => $address->id,
                'label' => trim($address->business_name.' — '.$address->address),
                'business_name' => $address->business_name,
            ])
            ->values()
            ->all();

        return response()->json(['addresses' => $addresses]);
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
