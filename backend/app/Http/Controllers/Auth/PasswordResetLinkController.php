<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Employer;
use App\Models\JobSeeker;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\View\View;

class PasswordResetLinkController extends Controller
{
    private const BROKERS = [
        'users' => User::class,
        'employers' => Employer::class,
        'job_seekers' => JobSeeker::class,
    ];

    /**
     * Display the password reset link request view.
     */
    public function create(): View
    {
        return view('auth.forgot-password');
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'account_type' => ['nullable', 'string', 'in:job_seekers'],
        ]);

        $email = Str::lower(trim($request->input('email')));
        $broker = $this->brokerForEmail($email, $request->input('account_type', 'job_seekers'));
        $status = $broker !== null
            ? Password::broker($broker)->sendResetLink(['email' => $email])
            : Password::INVALID_USER;

        return $status == Password::RESET_LINK_SENT
                    ? back()->with('status', __($status))
                    : back()->withInput($request->only('email'))
                            ->withErrors(['email' => __($status)]);
    }

    private function brokerForEmail(string $email, string $requestedBroker): ?string
    {
        $modelClass = self::BROKERS[$requestedBroker] ?? null;
        if (!$modelClass) {
            return null;
        }

        return $modelClass::query()->whereRaw('LOWER(email) = ?', [$email])->exists()
            ? $requestedBroker
            : null;
    }
}
