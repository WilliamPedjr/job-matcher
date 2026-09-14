<?php

namespace App\Providers;

use App\Models\Employer;
use App\Models\JobSeeker;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            $accountType = match (true) {
                $notifiable instanceof Employer => 'employers',
                $notifiable instanceof JobSeeker => 'job_seekers',
                $notifiable instanceof User => 'users',
                default => config('auth.defaults.passwords', 'users'),
            };

            return url(route('password.reset', [
                'token' => $token,
                'email' => $notifiable->getEmailForPasswordReset(),
                'account_type' => $accountType,
            ], false));
        });
    }
}
