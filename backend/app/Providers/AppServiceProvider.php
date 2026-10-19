<?php

namespace App\Providers;

use App\Models\Employer;
use App\Models\JobSeeker;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
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
        $passwordBrokerFor = static function (object $notifiable): string {
            return match (true) {
                $notifiable instanceof Employer => 'employers',
                $notifiable instanceof JobSeeker => 'job_seekers',
                $notifiable instanceof User => 'users',
                default => config('auth.defaults.passwords', 'users'),
            };
        };

        $resetUrl = static function (object $notifiable, string $token) use ($passwordBrokerFor): string {
            $accountType = $passwordBrokerFor($notifiable);

            return url(route('password.reset', [
                'token' => $token,
                'email' => $notifiable->getEmailForPasswordReset(),
                'account_type' => $accountType,
            ], false));
        };

        ResetPassword::createUrlUsing($resetUrl);
        ResetPassword::toMailUsing(static function (object $notifiable, string $token) use ($resetUrl, $passwordBrokerFor): MailMessage {
            $name = trim((string) ($notifiable->full_name ?? $notifiable->name ?? $notifiable->company_name ?? ''));
            $expires = config('auth.passwords.'.$passwordBrokerFor($notifiable).'.expire', 60);

            return (new MailMessage)
                ->subject('LNU-HiRe | Password Reset Request')
                ->greeting('Dear '.($name ?: 'Account Holder').',')
                ->line('A request has been received to reset the password for your LNU-HiRe account.')
                ->line('If you submitted this request, please use the button below to set a new password.')
                ->action('Reset Password', $resetUrl($notifiable, $token))
                ->line('For your account security, this password reset link will expire in '.$expires.' minutes.')
                ->line('If you did not request a password reset, please disregard this message. Your password will remain unchanged.')
                ->salutation('Respectfully, LNU-HiRe Support | Leyte Normal University');
        });

        VerifyEmail::toMailUsing(static function (object $notifiable, string $verificationUrl): MailMessage {
            $name = trim((string) ($notifiable->full_name ?? $notifiable->name ?? $notifiable->company_name ?? ''));

            return (new MailMessage)
                ->subject('LNU-HiRe | Email Address Verification')
                ->greeting('Dear '.($name ?: 'Account Holder').',')
                ->line('Thank you for registering with LNU-HiRe, the recruitment platform of Leyte Normal University.')
                ->line('Please verify your email address using the button below to complete the verification process for your account.')
                ->action('Verify Email Address', $verificationUrl)
                ->line('If you did not register for this account, please disregard this message. No further action is required.')
                ->salutation('Respectfully, LNU-HiRe Support | Leyte Normal University');
        });
    }
}
