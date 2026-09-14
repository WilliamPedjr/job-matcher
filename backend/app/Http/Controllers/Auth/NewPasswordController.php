<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Employer;
use App\Models\JobSeeker;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Illuminate\View\View;

class NewPasswordController extends Controller
{
    private const BROKERS = [
        'users' => User::class,
        'employers' => Employer::class,
        'job_seekers' => JobSeeker::class,
    ];

    /**
     * Display the password reset view.
     */
    public function create(Request $request): View
    {
        return view('auth.reset-password', ['request' => $request]);
    }

    /**
     * Handle an incoming new password request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'token' => ['required'],
            'email' => ['required', 'email'],
            'account_type' => ['nullable', 'string', 'in:users,employers,job_seekers'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $credentials = $request->only('email', 'password', 'password_confirmation', 'token');
        $credentials['email'] = Str::lower(trim($credentials['email']));
        $status = Password::INVALID_USER;

        foreach ($this->brokersForEmail($credentials['email'], $request->input('account_type', 'users')) as $broker) {
            $status = Password::broker($broker)->reset(
                $credentials,
                function ($user) use ($request) {
                    $attributes = [
                        'password' => Hash::make($request->password),
                    ];

                    if (Schema::hasColumn($user->getTable(), 'remember_token')) {
                        $attributes['remember_token'] = Str::random(60);
                    }

                    $user->forceFill($attributes)->save();

                    event(new PasswordReset($user));
                }
            );

            if ($status === Password::PASSWORD_RESET) {
                break;
            }
        }

        // If the password was successfully reset, we will redirect the user back to
        // the application's home authenticated view. If there is an error we can
        // redirect them back to where they came from with their error message.
        return $status == Password::PASSWORD_RESET
                    ? redirect('/app-login')->with('status', __($status))
                    : back()->withInput($request->only('email'))
                            ->withErrors(['email' => __($status)]);
    }

    private function brokersForEmail(string $email, string $requestedBroker): array
    {
        $modelClass = self::BROKERS[$requestedBroker] ?? null;
        if (!$modelClass) {
            return [];
        }

        return $modelClass::query()->whereRaw('LOWER(email) = ?', [$email])->exists()
            ? [$requestedBroker]
            : [];
    }
}
