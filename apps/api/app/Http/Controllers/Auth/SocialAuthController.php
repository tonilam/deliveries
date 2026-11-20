<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\SocialAuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class SocialAuthController extends Controller
{
    /** @var list<string> */
    private const PROVIDERS = ['google', 'apple'];

    public function __construct(
        private readonly SocialAuthService $socialAuth,
    ) {}

    public function redirect(string $provider): RedirectResponse
    {
        $this->assertProvider($provider);

        return Socialite::driver($provider)->redirect();
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $this->assertProvider($provider);

        $frontend = rtrim((string) config('app.frontend_url'), '/');

        try {
            $socialUser = Socialite::driver($provider)->user();
            $user = $this->socialAuth->findOrCreate($provider, $socialUser);

            if (! $user->is_active) {
                return redirect()->away($frontend.'/login?error=sso_failed');
            }

            Auth::login($user);
            $request->session()->regenerate();
        } catch (\Throwable) {
            return redirect()->away($frontend.'/login?error=sso_failed');
        }

        return redirect()->away($frontend.'/auth/callback');
    }

    private function assertProvider(string $provider): void
    {
        if (! in_array($provider, self::PROVIDERS, true)) {
            throw new NotFoundHttpException;
        }
    }
}
