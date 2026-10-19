<?php

namespace App\Notifications\Concerns;

use Illuminate\Notifications\Messages\MailMessage;

trait UsesOfficialReplyTo
{
    private function applyOfficialReplyTo(MailMessage $message): void
    {
        $officialEmail = trim((string) config('mail.from.address'));
        $personnelEmail = trim((string) $this->personnelEmail);
        $officialName = trim((string) config('mail.from.name', 'LNU-HiRe Personnel'));

        if (!filter_var($officialEmail, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $officialDomain = strtolower(substr(strrchr($officialEmail, '@'), 1));
        $personnelDomain = strtolower(substr(strrchr($personnelEmail, '@') ?: '', 1));
        $usePersonnelEmail = filter_var($personnelEmail, FILTER_VALIDATE_EMAIL)
            && $personnelDomain === $officialDomain;

        $message->replyTo(
            $usePersonnelEmail ? $personnelEmail : $officialEmail,
            $usePersonnelEmail ? ($this->personnelName ?: $officialName) : $officialName
        );
    }
}
