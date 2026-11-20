<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CreateUserRequest;
use App\Models\Company;
use App\Models\User;
use App\Services\CompanyDomainService;
use App\Services\InvitationService;
use Illuminate\Http\JsonResponse;

class CreateUserController extends Controller
{
    public function __construct(
        private readonly InvitationService $invitations,
        private readonly CompanyDomainService $domains,
    ) {}

    public function __invoke(CreateUserRequest $request): JsonResponse
    {
        $email = $request->string('email')->toString();
        $role = UserRole::from($request->string('role')->toString());
        $this->invitations->assertEmailAvailable($email);

        $companyId = null;
        if ($role === UserRole::Customer) {
            $company = Company::query()->findOrFail($request->integer('company_id'));
            $this->domains->assertEmailAllowedForCompany($email, $company);
            $companyId = $company->id;
        }

        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $email,
            'password' => $request->string('password')->toString(),
            'role' => $role,
            'is_active' => true,
            'must_change_password' => $request->boolean('must_change_password'),
            'company_id' => $companyId,
        ]);

        return response()->json([
            'user' => $user,
        ], 201);
    }
}
