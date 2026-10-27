<?php

namespace App\Notifications;

use App\Notifications\Concerns\UsesOfficialReplyTo;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApplicationScheduleNotification extends Notification
{
    use Queueable, UsesOfficialReplyTo;

    public function __construct(
        public readonly string $applicantName,
        public readonly string $jobTitle,
        public readonly string $stage,
        public readonly array $schedule,
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
        $label = $this->stage === 'interview' ? 'Interview' : 'Teaching Demonstration';
        $date = Carbon::parse($this->schedule['date'], 'Asia/Manila')->format('F j, Y');
        $time = $this->schedule['time']
            ? Carbon::parse($this->schedule['date'].' '.$this->schedule['time'], 'Asia/Manila')->format('g:i A').' (Philippine Time)'
            : 'To be confirmed';
        $message = (new MailMessage)
            ->subject('LNU-HiRe | '.$label.' Schedule')
            ->greeting('Dear '.(trim($this->applicantName) ?: 'Applicant').',')
            ->line('Your '.strtolower($label).' for your application at Leyte Normal University has been scheduled. Please refer to the details below.')
            ->line('Position: '.$this->jobTitle)
            ->line('Date: '.$date)
            ->line('Time: '.$time)
            ->line('Venue: '.($this->schedule['place'] ?: 'To be confirmed'));
        if ($this->schedule['notes']) $message->line('Preparation / Instructions: '.$this->schedule['notes']);
        $message->line('Please refer to this latest schedule and contact the hiring personnel if you need clarification.')
            ->salutation('Respectfully, LNU-HiRe Personnel | Leyte Normal University')
            ->view(['html' => 'emails.application-status', 'text' => 'emails.application-status-text']);
        $this->applyOfficialReplyTo($message);

        return $message;
    }
}
