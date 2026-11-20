<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\RegistrationDisabledException;
use App\Http\Controllers\Controller;
use App\Services\SocialAuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class SocialAuthController extends Controller
{
    /** @var list<string> */
    private const PROVIDERS = ['google', 'apple'];

    public function __construct(
        private readonly SocialAuthService $socialAuth,
    ) {}

    public function redirect(Request $request, string $provider): RedirectResponse
    {
        $this->assertProvider($provider);

        if ($request->filled('invite')) {
            $request->session()->put('invitation_token', $request->string('invite')->toString());
        } else {
            $request->session()->forget('invitation_token');
        }

        return Socialite::driver($provider)->redirect();
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $this->assertProvider($provider);

        $frontend = rtrim((string) config('app.frontend_url'), '/');
        $invitationToken = $request->session()->pull('invitation_token');

        try {
            $socialUser = Socialite::driver($provider)->user();
            $user = $this->socialAuth->findOrCreate($provider, $socialUser, $invitationToken);

            if (! $user->is_active) {
                return redirect()->away($frontend.'/login?error=sso_failed');
            }

            Auth::login($user);
            $request->session()->regenerate();
        } catch (RegistrationDisabledException) {
            return redirect()->away($frontend.'/login?error=registration_disabled');
        } catch (ValidationException $e) {
            $message = collect($e->errors())->flatten()->first() ?? 'Invitation could not be completed.';
            $target = is_string($invitationToken) && $invitationToken !== ''
                ? $frontend.'/invite/'.$invitationToken.'?error='.urlencode((string) $message)
                : $frontend.'/login?error=sso_failed';

            return redirect()->away($target);
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
