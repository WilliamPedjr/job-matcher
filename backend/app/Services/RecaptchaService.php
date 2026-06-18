<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class RecaptchaService
{
    public function verify(string $token, ?string $remoteIp = null): array
    {
        $secret = env('RECAPTCHA_SECRET');
        if (!$secret) {
            throw new \RuntimeException('reCAPTCHA secret is not configured.');
        }

        $payload = [
            'secret' => $secret,
            'response' => $token,
        ];

        if ($remoteIp) {
            $payload['remoteip'] = $remoteIp;
        }

        return Http::asForm()
            ->post('https://www.google.com/recaptcha/api/siteverify', $payload)
            ->json() ?? [];
    }
}
