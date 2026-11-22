<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListLoadActivityRequest;
use App\Models\Load;
use App\Models\User;
use App\Services\LoadActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Spatie\Activitylog\Models\Activity;

class ListLoadActivityController extends Controller
{
    public function __invoke(ListLoadActivityRequest $request, Load $load): JsonResponse
    {
        $perPage = $request->perPage();
        $loadId = $load->id;

        $query = Activity::query()
            ->where('log_name', LoadActivityLogger::LOG_NAME)
            ->where(function ($builder) use ($loadId): void {
                $builder
                    ->where(function ($subject) use ($loadId): void {
                        $subject
                            ->where('subject_type', Load::class)
                            ->where('subject_id', $loadId);
                    })
                    ->orWhereJsonContains('properties->related_load_ids', $loadId);
            })
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

        $subject = null;
        if ($activity->subject instanceof Load) {
            $activity->subject->loadMissing([]);
            $subject = [
                'id' => $activity->subject->id,
                'type' => $activity->subject->type->value,
                'type_label' => $activity->subject->type->label(),
                'parent_load_id' => $activity->subject->parent_load_id,
            ];
        }

        return [
            'id' => $activity->id,
            'event' => $activity->event ?? '',
            'description' => $activity->description ?? '',
            'created_at' => $activity->created_at?->toIso8601String(),
            'causer' => $causer,
            'impersonator' => $impersonator,
            'subject' => $subject,
            'item' => isset($properties['item']) && is_array($properties['item'])
                ? $properties['item']
                : null,
            'changes' => $this->buildChanges(
                $properties,
                $activity->subject instanceof Load ? $activity->subject : null,
                $activity->event ?? '',
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $properties
     * @return list<array{field: string, label: string, old: mixed, new: mixed}>
     */
    private function buildChanges(array $properties, ?Load $load, string $event): array
    {
        $old = isset($properties['old']) && is_array($properties['old']) ? $properties['old'] : [];
        $attributes = isset($properties['attributes']) && is_array($properties['attributes']) ? $properties['attributes'] : [];

        if ($event === 'created') {
            $keys = array_keys($attributes);
        } else {
            $keys = array_unique(array_merge(array_keys($old), array_keys($attributes)));
        }

        $changes = [];
        foreach ($keys as $key) {
            if (! is_string($key)) {
                continue;
            }
            $changes[] = [
                'field' => $key,
                'label' => LoadActivityLogger::fieldLabel($key, $load),
                'old' => $old[$key] ?? null,
                'new' => $attributes[$key] ?? null,
            ];
        }

        return $changes;
    }
}
