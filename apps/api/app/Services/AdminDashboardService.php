<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Load;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AdminDashboardService
{
    /**
     * @return array{
     *     user_count: int,
     *     company_count: int,
     *     loads_by_week: list<array{week_start: string, count: int}>,
     *     state_flows: list<array{
     *         from_state: string,
     *         from_country: string,
     *         to_state: string,
     *         to_country: string,
     *         count: int
     *     }>
     * }
     */
    public function stats(): array
    {
        [$windowStart, $windowEnd] = $this->pickupWindow();

        return [
            'user_count' => User::query()->count(),
            'company_count' => Company::query()->count(),
            'loads_by_week' => $this->loadsByWeek($windowStart, $windowEnd),
            'state_flows' => $this->stateFlows($windowStart, $windowEnd),
        ];
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function pickupWindow(): array
    {
        $now = CarbonImmutable::now('UTC');
        $start = $now->subMonths(4)->startOfWeek(CarbonImmutable::MONDAY);
        $end = $now->endOfWeek(CarbonImmutable::SUNDAY);

        return [$start, $end];
    }

    /**
     * @return list<array{week_start: string, count: int}>
     */
    private function loadsByWeek(CarbonImmutable $windowStart, CarbonImmutable $windowEnd): array
    {
        /** @var Collection<string, int> $counts */
        $counts = Load::query()
            ->whereNotNull('pickup_date')
            ->whereDate('pickup_date', '>=', $windowStart->toDateString())
            ->whereDate('pickup_date', '<=', $windowEnd->toDateString())
            ->get(['pickup_date'])
            ->groupBy(static function (Load $load): string {
                return CarbonImmutable::parse($load->pickup_date, 'UTC')
                    ->startOfWeek(CarbonImmutable::MONDAY)
                    ->format('Y-m-d');
            })
            ->map(static fn (Collection $group): int => $group->count());

        $weeks = [];
        for ($cursor = $windowStart; $cursor->lte($windowEnd); $cursor = $cursor->addWeek()) {
            $key = $cursor->format('Y-m-d');
            $weeks[] = [
                'week_start' => $key,
                'count' => (int) ($counts->get($key, 0)),
            ];
        }

        return $weeks;
    }

    /**
     * @return list<array{
     *     from_state: string,
     *     from_country: string,
     *     to_state: string,
     *     to_country: string,
     *     count: int
     * }>
     */
    private function stateFlows(CarbonImmutable $windowStart, CarbonImmutable $windowEnd): array
    {
        $rows = DB::table('loads')
            ->join('addresses as from_addr', 'loads.collection_address_id', '=', 'from_addr.id')
            ->join('addresses as to_addr', 'loads.delivery_address_id', '=', 'to_addr.id')
            ->join('zones as from_zone', 'from_addr.zone_id', '=', 'from_zone.id')
            ->join('zones as to_zone', 'to_addr.zone_id', '=', 'to_zone.id')
            ->join('countries as from_country', 'from_zone.country_id', '=', 'from_country.id')
            ->join('countries as to_country', 'to_zone.country_id', '=', 'to_country.id')
            ->whereNotNull('loads.pickup_date')
            ->whereDate('loads.pickup_date', '>=', $windowStart->toDateString())
            ->whereDate('loads.pickup_date', '<=', $windowEnd->toDateString())
            ->whereNotNull('loads.collection_address_id')
            ->whereNotNull('loads.delivery_address_id')
            ->groupBy(
                'from_addr.state',
                'from_country.code',
                'to_addr.state',
                'to_country.code',
            )
            ->orderBy('from_country.code')
            ->orderBy('from_addr.state')
            ->orderBy('to_country.code')
            ->orderBy('to_addr.state')
            ->select([
                'from_addr.state as from_state',
                'from_country.code as from_country',
                'to_addr.state as to_state',
                'to_country.code as to_country',
                DB::raw('count(*) as count'),
            ])
            ->get();

        return $rows->map(static function (object $row): array {
            return [
                'from_state' => (string) $row->from_state,
                'from_country' => (string) $row->from_country,
                'to_state' => (string) $row->to_state,
                'to_country' => (string) $row->to_country,
                'count' => (int) $row->count,
            ];
        })->all();
    }
}
