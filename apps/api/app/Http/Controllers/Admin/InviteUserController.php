<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\InviteUserRequest;
use App\Models\Company;
use App\Services\CompanyDomainService;
use App\Services\InvitationService;
use Illuminate\Http\JsonResponse;

class InviteUserController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitations,
        private readonly CompanyDomainService $domains,
    ) {}

    public function __invoke(InviteUserRequest $request): JsonResponse
    {
        $email = $request->string('email')->toString();
        $role = UserRole::from($request->string('role')->toString());

        $companyId = null;
        if ($role === UserRole::Customer) {
            $company = Company::query()->findOrFail($request->integer('company_id'));
            $this->domains->assertEmailAllowedForCompany($email, $company);
            $companyId = $company->id;
        }

        $invitation = $this->invitations->createAndSend(
            $request->user(),
            $request->string('name')->toString(),
            $email,
            $role,
            $companyId,
        );

        return response()->json([
            'invitation' => [
                'id' => $invitation->id,
                'name' => $invitation->name,
                'email' => $invitation->email,
                'role' => $invitation->role->value,
                'company_id' => $invitation->company_id,
                'expires_at' => $invitation->expires_at->toIso8601String(),
            ],
            'message' => 'Invitation sent',
        ], 201);
    }
}
