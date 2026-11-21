<?php

namespace App\Http\Controllers\Auth;

use App\Enums\FeatureKey;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use App\Services\CompanyDomainService;
use App\Services\FeatureService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class RegisterController extends Controller
{
    public function __construct(
        private readonly FeatureService $features,
        private readonly CompanyDomainService $domains,
    ) {}

    public function __invoke(RegisterRequest $request): JsonResponse
    {
        if (! $this->features->isEnabled(FeatureKey::UserRegistration)) {
            return response()->json([
                'message' => 'User registration is currently disabled.',
            ], 403);
        }

        $email = $request->string('email')->toString();
        $companyId = $request->filled('company_id') ? $request->integer('company_id') : null;
        $matches = $this->domains->companiesMatchingEmail($email);

        if ($matches->count() > 1 && $companyId === null) {
            return response()->json([
                'message' => 'Select which company to join.',
                'errors' => [
                    'company_id' => ['Select which company to join.'],
                ],
                'companies' => $this->domains->companyChoicesForEmail($email),
            ], 422);
        }

        $company = $this->domains->resolveCompanyForEmail($email, $companyId);

        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $email,
            'password' => $request->string('password')->toString(),
            'role' => UserRole::Customer,
            'is_active' => true,
            'company_id' => $company->id,
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'user' => $user->toAuthPayload(),
        ], 201);
    }
}
