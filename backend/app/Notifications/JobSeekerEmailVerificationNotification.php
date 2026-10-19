<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class JobSeekerEmailVerificationNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $verificationUrl
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('LNU-HiRe | Email Address Verification')
            ->greeting('Dear '.(trim((string) $notifiable->full_name) ?: 'Applicant').',')
            ->line('Thank you for registering with LNU-HiRe, the recruitment platform of Leyte Normal University.')
            ->line('To complete your registration and enable access to your account, please verify your email address using the button below.')
            ->action('Verify Email Address', $this->verificationUrl)
            ->line('If you did not register for this account, please disregard this message. No further action is required.')
            ->salutation('Respectfully, LNU-HiRe Support | Leyte Normal University');
    }
}
