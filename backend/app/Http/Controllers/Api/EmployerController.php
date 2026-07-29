<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Archive;
use App\Models\Employer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class EmployerController extends Controller
{
    public function index(): JsonResponse
    {
        $employers = Employer::query()->orderBy('id')->get()->map(fn (Employer $employer) => $this->serialize($employer));
        return response()->json($employers);
    }

    public function store(Request $request): JsonResponse
    {
        $this->mergeEmployerAliases($request);

        $data = $request->validate([
            'company_name' => ['nullable', 'string', 'max:255'],
            'full_name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:employers,email'],
            'username' => ['nullable', 'string', 'max:255', 'unique:employers,username'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
        ]);

        $employer = Employer::create([
            'company_name' => $data['company_name'] ?? null,
            'full_name' => $data['full_name'] ?? null,
            'email' => Str::lower(trim($data['email'])),
            'username' => $data['username'] ?? null,
            'phone' => $data['phone'] ?? null,
            'password' => Hash::make($data['password']),
        ]);

        return response()->json($this->serialize($employer), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $employer = Employer::findOrFail($id);
        $this->mergeEmployerAliases($request);

        $data = $request->validate([
            'company_name' => ['nullable', 'string', 'max:255'],
            'full_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'username' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['nullable', 'string', 'min:8', 'max:72'],
        ]);

        if (array_key_exists('company_name', $data)) {
            $employer->company_name = $data['company_name'];
        }
        if (array_key_exists('full_name', $data)) {
            $employer->full_name = $data['full_name'];
        }
        if (array_key_exists('email', $data)) {
            $employer->email = Str::lower(trim((string) $data['email']));
        }
        if (array_key_exists('username', $data)) {
            $employer->username = $data['username'];
        }
        if (array_key_exists('phone', $data)) {
            $employer->phone = $data['phone'];
        }
        if (!empty($data['password'])) {
            $employer->password = Hash::make($data['password']);
        }

        $employer->save();

        return response()->json($this->serialize($employer));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $employer = Employer::findOrFail($id);

        Archive::create([
            'record_type' => 'personnel',
            'record_id' => $employer->id,
            'title' => $employer->company_name ?: $employer->full_name,
            'subtitle' => $employer->email,
            'data' => $this->serialize($employer),
            ...Archive::actorFromRequest($request),
            'deleted_at' => now(),
        ]);

        $employer->delete();
        return response()->json(['message' => 'Employer deleted successfully.']);
    }

    private function serialize(Employer $employer): array
    {
        return [
            'id' => $employer->id,
            'company_name' => $employer->company_name,
            'companyName' => $employer->company_name,
            'full_name' => $employer->full_name,
            'fullName' => $employer->full_name,
            'contactName' => $employer->full_name,
            'email' => $employer->email,
            'username' => $employer->username,
            'phone' => $employer->phone,
            'created_at' => $employer->created_at,
            'createdAt' => $employer->created_at,
            'updated_at' => $employer->updated_at,
            'updatedAt' => $employer->updated_at,
        ];
    }

    private function mergeEmployerAliases(Request $request): void
    {
        $aliases = [
            'companyName' => 'company_name',
            'contactName' => 'full_name',
        ];

        $merged = [];
        foreach ($aliases as $camel => $snake) {
            if (!$request->has($snake) && $request->has($camel)) {
                $merged[$snake] = $request->input($camel);
            }
        }

        if ($merged) {
            $request->merge($merged);
        }
    }
}
