<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Archive;
use App\Models\Employer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
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
            'email' => ['nullable', 'required_without:id_number', 'email', 'max:255', 'unique:employers,email'],
            'username' => ['nullable', 'string', 'max:255', 'unique:employers,username'],
            'id_number' => ['nullable', 'required_without:email', 'string', 'max:255', 'unique:employers,id_number'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
        ]);

        $employer = Employer::create([
            'company_name' => $data['company_name'] ?? null,
            'full_name' => $data['full_name'] ?? null,
            'email' => isset($data['email']) ? Str::lower(trim((string) $data['email'])) : null,
            'username' => $this->nullableTrim($data['username'] ?? null),
            'id_number' => $this->nullableTrim($data['id_number'] ?? null),
            'phone' => $data['phone'] ?? null,
            'password' => Hash::make($data['password']),
        ]);

        $name = $employer->company_name ?: $employer->full_name ?: $employer->email;
        ActivityLog::record('personnel.created', "Added employer account for {$name}.", $request, [
            'subject_type' => 'personnel',
            'subject_id' => $employer->id,
            'subject_name' => $name,
            'metadata' => [
                'email' => $employer->email,
                'id_number' => $employer->id_number,
                'role' => 'employer',
            ],
        ]);

        return response()->json($this->serialize($employer), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $employer = Employer::findOrFail($id);
        $this->mergeEmployerAliases($request);
        $before = $this->serialize($employer);

        $data = $request->validate([
            'company_name' => ['nullable', 'string', 'max:255'],
            'full_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('employers', 'email')->ignore($employer->id)],
            'username' => ['nullable', 'string', 'max:255', Rule::unique('employers', 'username')->ignore($employer->id)],
            'id_number' => ['nullable', 'string', 'max:255', Rule::unique('employers', 'id_number')->ignore($employer->id)],
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
            $employer->username = $this->nullableTrim($data['username']);
        }
        if (array_key_exists('id_number', $data)) {
            $employer->id_number = $this->nullableTrim($data['id_number']);
        }
        if (array_key_exists('phone', $data)) {
            $employer->phone = $data['phone'];
        }
        if (!empty($data['password'])) {
            $employer->password = Hash::make($data['password']);
        }

        $employer->save();
        $name = $employer->company_name ?: $employer->full_name ?: $employer->email;
        ActivityLog::record('personnel.updated', "Updated employer account for {$name}.", $request, [
            'subject_type' => 'personnel',
            'subject_id' => $employer->id,
            'subject_name' => $name,
            'metadata' => [
                'before' => $before,
                'after' => $this->serialize($employer),
                'role' => 'employer',
            ],
        ]);

        return response()->json($this->serialize($employer));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $employer = Employer::findOrFail($id);
        $name = $employer->company_name ?: $employer->full_name ?: $employer->email;
        $serialized = $this->serialize($employer);

        Archive::create([
            'record_type' => 'personnel',
            'record_id' => $employer->id,
            'title' => $name,
            'subtitle' => $employer->email,
            'data' => $serialized,
            ...Archive::actorFromRequest($request),
            'deleted_at' => now(),
        ]);

        ActivityLog::record('personnel.deleted', "Deleted employer account for {$name}.", $request, [
            'subject_type' => 'personnel',
            'subject_id' => $employer->id,
            'subject_name' => $name,
            'metadata' => [
                'email' => $employer->email,
                'username' => $employer->username,
                'id_number' => $employer->id_number,
                'role' => 'employer',
                'record' => $serialized,
            ],
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
            'id_number' => $employer->id_number,
            'idNumber' => $employer->id_number,
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
            'idNumber' => 'id_number',
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

    private function nullableTrim(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value !== '' ? $value : null;
    }
}
