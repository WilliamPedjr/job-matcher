<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class Archive extends Model
{
    use HasFactory;

    protected $fillable = [
        'record_type',
        'record_id',
        'title',
        'subtitle',
        'data',
        'actor_name',
        'actor_email',
        'actor_role',
        'deleted_at',
    ];

    protected $casts = [
        'data' => 'array',
        'deleted_at' => 'datetime',
    ];

    public static function actorFromRequest(Request $request): array
    {
        $name = trim((string) ($request->header('X-Actor-Name') ?: $request->input('actorName', '')));
        $email = Str::lower(trim((string) ($request->header('X-Actor-Email') ?: $request->input('actorEmail', ''))));
        $role = Str::lower(trim((string) ($request->header('X-Actor-Role') ?: $request->input('actorRole', ''))));

        return [
            'actor_name' => $name !== '' ? $name : null,
            'actor_email' => $email !== '' ? $email : null,
            'actor_role' => $role !== '' ? $role : null,
        ];
    }
}
