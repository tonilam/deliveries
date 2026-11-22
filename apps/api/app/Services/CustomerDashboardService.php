<?php

namespace App\Services;

use App\Enums\CompanyType;
use App\Enums\LoadType;
use App\Models\Company;
use App\Models\Load;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CustomerDashboardService
{
    /**
     * @return array{
     *     company_type: string,
     *     top_customers: list<array{company_id: int, business_name: string, load_count: int}>,
     *     top_providers: list<array{company_id: int, business_name: string, load_count: int}>,
     *     loads_by_date: list<array{pickup_date: string, count: int}>
     * }
     */
    public function stats(Company $owner): array
    {
        $type = $owner->company_type ?? CompanyType::Broker;

        return [
            'company_type' => $type->value,
            'top_customers' => $type === CompanyType::Provider || $type === CompanyType::Broker
                ? $this->topCounterparties($owner->id, 'customer_company_id')
                : [],
            'top_providers' => $type === CompanyType::Customer || $type === CompanyType::Broker
                ? $this->topCounterparties($owner->id, 'provider_company_id')
                : [],
            'loads_by_date' => $this->loadsByPickupDateThisAndNextWeek($owner->id),
        ];
    }

    /**
     * @return list<array{company_id: int, business_name: string, load_count: int}>
     */
    private function topCounterparties(int $ownerCompanyId, string $partyColumn): array
    {
        $rows = DB::table('loads')
            ->join('companies', "loads.{$partyColumn}", '=', 'companies.id')
            ->where('loads.company_id', $ownerCompanyId)
            ->where('loads.type', LoadType::Direct)
            ->whereNull('loads.parent_load_id')
            ->whereNotNull("loads.{$partyColumn}")
            ->groupBy('companies.id', 'companies.business_name')
            ->orderByDesc('load_count')
            ->orderBy('companies.business_name')
            ->limit(5)
            ->select([
                'companies.id as company_id',
                'companies.business_name',
                DB::raw('count(*) as load_count'),
            ])
            ->get();

        return $rows->map(static function (object $row): array {
            return [
                'company_id' => (int) $row->company_id,
                'business_name' => (string) $row->business_name,
                'load_count' => (int) $row->load_count,
            ];
        })->all();
    }

    /**
     * @return list<array{pickup_date: string, count: int}>
     */
    private function loadsByPickupDateThisAndNextWeek(int $ownerCompanyId): array
    {
        $now = CarbonImmutable::now('UTC');
        $windowStart = $now->startOfWeek(CarbonImmutable::MONDAY);
        $windowEnd = $windowStart->addWeek()->endOfWeek(CarbonImmutable::SUNDAY);

        /** @var Collection<string, int> $counts */
        $counts = Load::query()
            ->primaryDirect()
            ->where('company_id', $ownerCompanyId)
            ->whereNotNull('pickup_date')
            ->whereDate('pickup_date', '>=', $windowStart->toDateString())
            ->whereDate('pickup_date', '<=', $windowEnd->toDateString())
            ->get(['pickup_date'])
            ->groupBy(static function (Load $load): string {
                return CarbonImmutable::parse($load->pickup_date, 'UTC')->format('Y-m-d');
            })
            ->map(static fn (Collection $group): int => $group->count());

        $days = [];
        for ($cursor = $windowStart; $cursor->lte($windowEnd); $cursor = $cursor->addDay()) {
            $key = $cursor->format('Y-m-d');
            $days[] = [
                'pickup_date' => $key,
                'count' => (int) ($counts->get($key, 0)),
            ];
        }

        return $days;
    }
}
