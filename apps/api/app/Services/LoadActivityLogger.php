<?php

namespace App\Services;

use App\Enums\LoadType;
use App\Models\Item;
use App\Models\Load;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Request as RequestFacade;

class LoadActivityLogger
{
    public const LOG_NAME = 'loads';

    /** @var array<string, string> */
    private const FIELD_LABELS = [
        'customer' => 'Customer',
        'provider' => 'Provider',
        'secondary_provider' => 'Secondary provider',
        'collection' => 'Collection',
        'delivery' => 'Delivery',
        'xdock' => 'X dock',
        'pallet_count' => 'Pallets',
        'pickup_date' => 'Pickup date',
        'pickup_time' => 'Pickup time',
        'dropoff_date' => 'Drop-off date',
        'dropoff_time' => 'Drop-off time',
        'truck_type' => 'Truck type',
    ];

    public function __construct(
        private readonly ImpersonationService $impersonation,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function displaySnapshot(Load $load): array
    {
        $payload = $load->fresh()->toCustomerPayload(false);
        $snapshot = [];

        foreach ($this->watchedFieldKeys($load) as $field) {
            $snapshot[$field] = $this->normalizeValue($payload[$field] ?? null);
        }

        if ($load->type === LoadType::Direct && $load->parent_load_id === null) {
            $options = $payload['vehicle_body_type_options'] ?? [];
            $values = $payload['vehicle_option_values'] ?? [];
            if (is_array($options)) {
                foreach ($options as $option) {
                    if (! is_array($option)) {
                        continue;
                    }
                    $key = $option['key'] ?? null;
                    if (! is_string($key) || $key === '') {
                        continue;
                    }
                    $optionValue = is_array($values) ? ($values[$key] ?? null) : null;
                    $snapshot['option:'.$key] = $this->normalizeValue($optionValue);
                }
            }
        }

        return $snapshot;
    }

    public function created(Load $load, User $user): void
    {
        $properties = [
            'attributes' => $this->displaySnapshot($load),
            'related_load_ids' => $this->relatedLoadIdsForSubject($load),
        ];

        $this->write($load, $user, 'created', $this->createdDescription($load), $properties);
    }

    /**
     * @param  array<string, mixed>  $before
     */
    public function updated(Load $load, User $user, array $before): void
    {
        $after = $this->displaySnapshot($load);
        $diff = $this->diffSnapshots($before, $after);
        if ($diff === []) {
            return;
        }

        $properties = [
            'old' => array_map(static fn (array $row) => $row['old'], $diff),
            'attributes' => array_map(static fn (array $row) => $row['new'], $diff),
            'related_load_ids' => $this->relatedLoadIdsForSubject($load),
        ];

        $this->write($load, $user, 'updated', $this->updatedDescription($load), $properties);
    }

    public function deleted(Load $load, User $user): void
    {
        $properties = [
            'related_load_ids' => $this->relatedLoadIdsForSubject($load),
        ];

        if ($load->type === LoadType::Direct && $load->parent_load_id === null) {
            $childIds = $load->children()->pluck('id')->all();
            $loadIds = array_merge([$load->id], $childIds);
            $properties['deleted_child_load_ids'] = $childIds;
            $properties['unassigned_item_count'] = Item::query()->whereIn('load_id', $loadIds)->count();
        } else {
            $properties['unassigned_item_count'] = Item::query()->where('load_id', $load->id)->count();
        }

        $this->write($load, $user, 'deleted', $this->deletedDescription($load), $properties);
    }

    public function itemAssigned(Load $load, Item $item, User $user): void
    {
        $item->loadMissing('goodType');

        $properties = [
            'related_load_ids' => $this->relatedLoadIdsForSubject($load),
            'item' => ['id' => $item->id, 'label' => $this->itemLabel($item)],
        ];

        $this->write($load, $user, 'item_assigned', 'Item assigned', $properties);
    }

    public function itemUnassigned(Load $load, Item $item, User $user): void
    {
        $item->loadMissing('goodType');

        $properties = [
            'related_load_ids' => $this->relatedLoadIdsForSubject($load),
            'item' => ['id' => $item->id, 'label' => $this->itemLabel($item)],
        ];

        $this->write($load, $user, 'item_unassigned', 'Item unassigned', $properties);
    }

    public function itemMoved(Load $from, Load $to, Item $item, User $user): void
    {
        $item->loadMissing('goodType');

        $related = [$from->id];
        if ($to->parent_load_id !== null && $to->parent_load_id !== $from->id) {
            $related[] = $to->parent_load_id;
        }

        $properties = [
            'related_load_ids' => array_values(array_unique($related)),
            'item' => ['id' => $item->id, 'label' => $this->itemLabel($item)],
            'from_load_id' => $from->id,
            'to_load_id' => $to->id,
        ];

        $this->write($to, $user, 'item_moved', 'Item moved', $properties);
    }

    /**
     * @param  array<string, mixed>  $properties
     */
    private function write(Load $load, User $user, string $event, string $description, array $properties): void
    {
        $properties = $this->withImpersonator($properties);

        activity(self::LOG_NAME)
            ->causedBy($user)
            ->performedOn($load)
            ->event($event)
            ->withProperties($properties)
            ->log($description);
    }

    /**
     * @param  array<string, mixed>  $properties
     * @return array<string, mixed>
     */
    private function withImpersonator(array $properties): array
    {
        $request = RequestFacade::instance();
        if (! $request instanceof Request) {
            return $properties;
        }

        $impersonator = $this->impersonation->impersonator($request);
        if ($impersonator === null) {
            return $properties;
        }

        $properties['impersonator'] = [
            'id' => $impersonator->id,
            'name' => $impersonator->name,
        ];

        return $properties;
    }

    /**
     * @return list<string>
     */
    private function watchedFieldKeys(Load $load): array
    {
        return match ($load->type) {
            LoadType::Direct => [
                'customer',
                'provider',
                'collection',
                'delivery',
                'pallet_count',
                'pickup_date',
                'pickup_time',
                'dropoff_date',
                'dropoff_time',
                'truck_type',
            ],
            LoadType::AddDrop => [
                'delivery',
                'pallet_count',
                'pickup_date',
                'pickup_time',
                'dropoff_date',
                'dropoff_time',
            ],
            LoadType::XDock => [
                'delivery',
                'xdock',
                'secondary_provider',
                'pallet_count',
                'pickup_date',
                'pickup_time',
                'dropoff_date',
                'dropoff_time',
            ],
        };
    }

    /**
     * @return list<int>
     */
    private function relatedLoadIdsForSubject(Load $load): array
    {
        if ($load->parent_load_id !== null) {
            return [$load->parent_load_id];
        }

        return [];
    }

    private function createdDescription(Load $load): string
    {
        return match ($load->type) {
            LoadType::Direct => 'Direct load created',
            LoadType::AddDrop => 'Add Drop load created',
            LoadType::XDock => 'X Dock load created',
        };
    }

    private function updatedDescription(Load $load): string
    {
        return match ($load->type) {
            LoadType::Direct => 'Direct load updated',
            LoadType::AddDrop => 'Add Drop load updated',
            LoadType::XDock => 'X Dock load updated',
        };
    }

    private function deletedDescription(Load $load): string
    {
        return match ($load->type) {
            LoadType::Direct => 'Direct load deleted',
            LoadType::AddDrop => 'Add Drop load deleted',
            LoadType::XDock => 'X Dock load deleted',
        };
    }

    private function itemLabel(Item $item): string
    {
        $order = is_string($item->order_number) ? trim($item->order_number) : '';
        if ($order !== '') {
            return $order;
        }

        $connote = is_string($item->connote) ? trim($item->connote) : '';
        if ($connote !== '') {
            return $connote;
        }

        $goods = $item->goodType?->name ?? '';
        if ($goods !== '') {
            return "{$goods} (#{$item->id})";
        }

        return "Item #{$item->id}";
    }

    private function normalizeValue(mixed $value): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @return array<string, array{old: mixed, new: mixed}>
     */
    public function diffSnapshots(array $before, array $after): array
    {
        $keys = array_unique(array_merge(array_keys($before), array_keys($after)));
        $diff = [];

        foreach ($keys as $key) {
            $old = $this->normalizeValue($before[$key] ?? null);
            $new = $this->normalizeValue($after[$key] ?? null);
            if ($old === $new) {
                continue;
            }
            $diff[$key] = ['old' => $old, 'new' => $new];
        }

        return $diff;
    }

    public static function fieldLabel(string $key, ?Load $load = null): string
    {
        if (str_starts_with($key, 'option:')) {
            $optionKey = substr($key, strlen('option:'));
            if ($load !== null) {
                $payload = $load->toCustomerPayload(false);
                $options = $payload['vehicle_body_type_options'] ?? [];
                if (is_array($options)) {
                    foreach ($options as $option) {
                        if (is_array($option) && ($option['key'] ?? null) === $optionKey) {
                            $label = $option['label'] ?? null;
                            if (is_string($label) && $label !== '') {
                                return $label;
                            }
                        }
                    }
                }
            }

            return $optionKey;
        }

        return self::FIELD_LABELS[$key] ?? $key;
    }
}
