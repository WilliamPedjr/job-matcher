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
            ->subject('Verify your LNU-HiRe account')
            ->greeting('Hello '.$notifiable->full_name.'!')
            ->line('Thanks for creating your LNU-HiRe job seeker account.')
            ->line('Please verify your email address before logging in.')
            ->action('Verify Account', $this->verificationUrl)
            ->line('If you did not create this account, you can ignore this email.');
    }
}
