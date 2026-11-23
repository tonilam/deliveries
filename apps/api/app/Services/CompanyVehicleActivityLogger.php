<?php

namespace App\Services;

use App\Models\Company;
use App\Models\User;
use App\Models\VehicleBodyType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Request as RequestFacade;

class CompanyVehicleActivityLogger
{
    public const LOG_NAME = 'company_vehicles';

    public function __construct(
        private readonly ImpersonationService $impersonation,
    ) {}

    public function activated(Company $company, VehicleBodyType $bodyType, User $user): void
    {
        $this->write($company, $bodyType, $user, 'activated', 'Body type activated', true);
    }

    public function deactivated(Company $company, VehicleBodyType $bodyType, User $user): void
    {
        $this->write($company, $bodyType, $user, 'deactivated', 'Body type deactivated', false);
    }

    private function write(
        Company $company,
        VehicleBodyType $bodyType,
        User $user,
        string $event,
        string $description,
        bool $active,
    ): void {
        $bodyType->loadMissing('category');

        $properties = [
            'body_type' => [
                'id' => $bodyType->id,
                'name' => $bodyType->name,
                'code' => $bodyType->code,
                'category_name' => $bodyType->category?->name ?? '',
            ],
            'old' => ['active' => ! $active],
            'attributes' => ['active' => $active],
        ];

        activity(self::LOG_NAME)
            ->causedBy($user)
            ->performedOn($company)
            ->event($event)
            ->withProperties($this->withImpersonator($properties))
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
}
