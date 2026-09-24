<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApplicationShortlistedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $applicantName,
        private readonly string $jobTitle,
        private readonly ?string $personnelName = null,
        private readonly ?string $personnelEmail = null
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject('Your LNU-HiRe application has been shortlisted')
            ->greeting('Hello '.$this->applicantName.'!')
            ->line('Your application has been shortlisted for the next stage of the hiring process.')
            ->line('Position: '.$this->jobTitle)
            ->line('Please wait for further instructions from the hiring personnel.')
            ->line('Thank you for using LNU-HiRe.');

        if ($this->personnelEmail) {
            $message->replyTo($this->personnelEmail, $this->personnelName ?: null);
        }

        return $message;
    }
}
