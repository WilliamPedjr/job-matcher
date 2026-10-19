<?php

namespace App\Notifications;

use App\Notifications\Concerns\UsesOfficialReplyTo;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApplicationShortlistedNotification extends Notification
{
    use Queueable, UsesOfficialReplyTo;

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
            ->subject('LNU-HiRe | Notification of Shortlisted Application')
            ->greeting('Dear '.(trim($this->applicantName) ?: 'Applicant').',')
            ->line('We are pleased to inform you that your application has been shortlisted for the next stage of the recruitment process at Leyte Normal University.')
            ->line('Position: '.$this->jobTitle)
            ->line('Please await further communication from the hiring personnel regarding the schedule and requirements for the next stage.')
            ->line('Thank you for your interest in serving Leyte Normal University.')
            ->salutation('Respectfully, LNU-HiRe Personnel | Leyte Normal University')
            ->view([
                'html' => 'emails.application-status',
                'text' => 'emails.application-status-text',
            ]);

        $this->applyOfficialReplyTo($message);

        return $message;
    }
}
