<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListCompanyVehicleActivityRequest;
use App\Models\Company;
use App\Models\User;
use App\Services\CompanyVehicleActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Spatie\Activitylog\Models\Activity;

class ListCompanyVehicleActivityController extends Controller
{
    public function __invoke(ListCompanyVehicleActivityRequest $request): JsonResponse
    {
        $company = $request->user()?->company;
        if ($company === null) {
            abort(403);
        }

        $perPage = $request->perPage();

        $query = Activity::query()
            ->where('log_name', CompanyVehicleActivityLogger::LOG_NAME)
            ->where('subject_type', Company::class)
            ->where('subject_id', $company->id)
            ->orderByDesc('id');

        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, (int) $request->input('page', 1)), $lastPage);
        $offset = ($page - 1) * $perPage;

        $rows = $query->offset($offset)->limit($perPage)->get();

        $from = $total === 0 ? null : $offset + 1;
        $to = $total === 0 ? null : min($offset + $rows->count(), $total);

        return response()->json([
            'activities' => $rows
                ->map(fn (Activity $activity) => $this->toActivityPayload($activity))
                ->values()
                ->all(),
            'meta' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
                'from' => $from,
                'to' => $to,
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function toActivityPayload(Activity $activity): array
    {
        $properties = $activity->properties instanceof Collection
            ? $activity->properties->toArray()
            : (is_array($activity->properties) ? $activity->properties : []);

        $causer = null;
        if ($activity->causer instanceof User) {
            $causer = [
                'id' => $activity->causer->id,
                'name' => $activity->causer->name,
            ];
        }

        $impersonator = null;
        if (isset($properties['impersonator']) && is_array($properties['impersonator'])) {
            $impersonator = [
                'id' => $properties['impersonator']['id'] ?? null,
                'name' => $properties['impersonator']['name'] ?? '',
            ];
        }

        $bodyType = null;
        if (isset($properties['body_type']) && is_array($properties['body_type'])) {
            $bodyType = [
                'id' => $properties['body_type']['id'] ?? null,
                'name' => $properties['body_type']['name'] ?? '',
                'code' => $properties['body_type']['code'] ?? '',
                'category_name' => $properties['body_type']['category_name'] ?? '',
            ];
        }

        return [
            'id' => $activity->id,
            'event' => $activity->event ?? '',
            'description' => $activity->description ?? '',
            'created_at' => $activity->created_at?->toIso8601String(),
            'causer' => $causer,
            'impersonator' => $impersonator,
            'body_type' => $bodyType,
            'changes' => $this->buildChanges($properties),
        ];
    }

    /**
     * @param  array<string, mixed>  $properties
     * @return list<array{field: string, label: string, old: mixed, new: mixed}>
     */
    private function buildChanges(array $properties): array
    {
        $old = isset($properties['old']) && is_array($properties['old']) ? $properties['old'] : [];
        $attributes = isset($properties['attributes']) && is_array($properties['attributes']) ? $properties['attributes'] : [];
        $keys = array_unique(array_merge(array_keys($old), array_keys($attributes)));

        $changes = [];
        foreach ($keys as $key) {
            if (! is_string($key)) {
                continue;
            }
            $changes[] = [
                'field' => $key,
                'label' => $key === 'active' ? 'Active' : $key,
                'old' => $old[$key] ?? null,
                'new' => $attributes[$key] ?? null,
            ];
        }

        return $changes;
    }
}
