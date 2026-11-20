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

        if ($request->filled('company_id')) {
            $request->session()->put('registration_company_id', $request->integer('company_id'));
        } else {
            $request->session()->forget('registration_company_id');
        }

        return Socialite::driver($provider)->redirect();
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $this->assertProvider($provider);

        $frontend = rtrim((string) config('app.frontend_url'), '/');
        $invitationToken = $request->session()->pull('invitation_token');
        $companyId = $request->session()->pull('registration_company_id');
        $companyId = is_numeric($companyId) ? (int) $companyId : null;

        $socialEmail = null;

        try {
            $socialUser = Socialite::driver($provider)->user();
            $socialEmail = $socialUser->getEmail();
            $user = $this->socialAuth->findOrCreate($provider, $socialUser, $invitationToken, $companyId);

            if (! $user->is_active) {
                return redirect()->away($frontend.'/login?error=sso_failed');
            }

            Auth::login($user);
            $request->session()->regenerate();
        } catch (RegistrationDisabledException) {
            return redirect()->away($frontend.'/login?error=registration_disabled');
        } catch (ValidationException $e) {
            $message = collect($e->errors())->flatten()->first() ?? 'Invitation could not be completed.';
            $registrationError = array_key_exists('company_id', $e->errors())
                || array_key_exists('email', $e->errors());

            if (is_string($invitationToken) && $invitationToken !== '') {
                $target = $frontend.'/invite/'.$invitationToken.'?error='.urlencode((string) $message);
            } elseif ($registrationError && is_string($socialEmail) && $socialEmail !== '') {
                $params = http_build_query([
                    'email' => $socialEmail,
                    'choose_company' => array_key_exists('company_id', $e->errors()) ? '1' : '0',
                    'error' => (string) $message,
                ]);
                $target = $frontend.'/register?'.$params;
            } else {
                $target = $frontend.'/login?error=sso_failed';
            }

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
