<?php

namespace App\Notifications;

use App\Notifications\Concerns\UsesOfficialReplyTo;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApplicationRejectedNotification extends Notification
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
            ->subject('LNU-HiRe | Application Status Notification')
            ->greeting('Dear '.(trim($this->applicantName) ?: 'Applicant').',')
            ->line('Thank you for your interest in employment at Leyte Normal University and for the time you devoted to your application.')
            ->line('Position: '.$this->jobTitle)
            ->line('We regret to inform you that your application for this position will not proceed to the next stage of the recruitment process.')
            ->line('We appreciate your interest in serving the University and encourage you to consider future vacancies that align with your qualifications.')
            ->salutation('Respectfully, LNU-HiRe Personnel | Leyte Normal University')
            ->view(['html' => 'emails.application-status', 'text' => 'emails.application-status-text']);

        $this->applyOfficialReplyTo($message);

        return $message;
    }
}
