<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employer;
use App\Models\JobSeeker;
use App\Services\RecaptchaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function verifyRecaptcha(Request $request, RecaptchaService $recaptchaService): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
        ]);

        $result = $recaptchaService->verify(
            $data['token'],
            $request->ip()
        );

        return response()->json($result);
    }

    public function employerLogin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $identifier = Str::lower(trim($data['identifier']));
        $employer = Employer::query()
            ->whereRaw('LOWER(email) = ?', [$identifier])
            ->orWhereRaw('LOWER(username) = ?', [$identifier])
            ->orWhereRaw('LOWER(company_name) = ?', [$identifier])
            ->first();

        if (!$employer || !$this->passwordMatchesAndUpgrades($data['password'], $employer)) {
            return response()->json(['message' => 'Invalid employer credentials.'], 401);
        }

        return response()->json($this->serializeEmployer($employer));
    }

    public function jobSeekerRegister(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fullName' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:job_seekers,email'],
            'username' => ['nullable', 'string', 'max:255', 'unique:job_seekers,username'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
            'confirmPassword' => ['nullable', 'string'],
        ]);

        if (($data['confirmPassword'] ?? $data['password']) !== $data['password']) {
            return response()->json(['message' => 'Passwords do not match.'], 422);
        }

        $jobSeeker = JobSeeker::create([
            'full_name' => $data['fullName'],
            'email' => Str::lower(trim($data['email'])),
            'username' => $data['username'] ?? null,
            'phone' => $data['phone'] ?? null,
            'password' => Hash::make($data['password']),
        ]);

        return response()->json([
            'message' => 'Job seeker registered successfully.',
            'jobSeeker' => $this->serializeJobSeeker($jobSeeker),
        ], 201);
    }

    public function jobSeekerLogin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $identifier = Str::lower(trim($data['identifier']));
        $jobSeeker = JobSeeker::query()
            ->whereRaw('LOWER(email) = ?', [$identifier])
            ->orWhereRaw('LOWER(username) = ?', [$identifier])
            ->first();

        if (!$jobSeeker || !$this->passwordMatchesAndUpgrades($data['password'], $jobSeeker)) {
            return response()->json(['message' => 'Invalid job seeker credentials.'], 401);
        }

        return response()->json($this->serializeJobSeeker($jobSeeker));
    }

    private function serializeEmployer(Employer $employer): array
    {
        return [
            'id' => $employer->id,
            'company_name' => $employer->company_name,
            'companyName' => $employer->company_name,
            'full_name' => $employer->full_name,
            'fullName' => $employer->full_name,
            'email' => $employer->email,
            'username' => $employer->username,
            'phone' => $employer->phone,
        ];
    }

    private function serializeJobSeeker(JobSeeker $jobSeeker): array
    {
        return [
            'id' => $jobSeeker->id,
            'full_name' => $jobSeeker->full_name,
            'fullName' => $jobSeeker->full_name,
            'email' => $jobSeeker->email,
            'username' => $jobSeeker->username,
            'phone' => $jobSeeker->phone,
        ];
    }

    private function passwordMatchesAndUpgrades(string $plainPassword, object $user): bool
    {
        $storedPassword = (string) ($user->password ?? '');
        if ($storedPassword === '') {
            return false;
        }

        if (Hash::check($plainPassword, $storedPassword)) {
            return true;
        }

        if ($this->looksLikeHashedPassword($storedPassword)) {
            return false;
        }

        if (!hash_equals($storedPassword, $plainPassword)) {
            return false;
        }

        $user->password = Hash::make($plainPassword);
        $user->save();

        return true;
    }

    private function looksLikeHashedPassword(string $password): bool
    {
        return preg_match('/^(\\$2y\\$|\\$2a\\$|\\$2b\\$|\\$argon2i\\$|\\$argon2id\\$)/', $password) === 1;
    }
}
