<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Throwable;

class ActivityLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'event',
        'description',
        'subject_type',
        'subject_id',
        'subject_name',
        'actor_name',
        'actor_email',
        'actor_role',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public static function record(string $event, string $description, ?Request $request = null, array $attributes = []): ?self
    {
        $actor = $request ? Archive::actorFromRequest($request) : [];

        try {
            return self::create([
                'event' => $event,
                'description' => $description,
                'subject_type' => $attributes['subject_type'] ?? null,
                'subject_id' => $attributes['subject_id'] ?? null,
                'subject_name' => $attributes['subject_name'] ?? null,
                'actor_name' => $actor['actor_name'] ?? $attributes['actor_name'] ?? null,
                'actor_email' => $actor['actor_email'] ?? $attributes['actor_email'] ?? null,
                'actor_role' => $actor['actor_role'] ?? $attributes['actor_role'] ?? null,
                'metadata' => $attributes['metadata'] ?? null,
            ]);
        } catch (Throwable) {
            return null;
        }
    }

    public function getActorLabelAttribute(): string
    {
        return trim((string) ($this->actor_name ?: $this->actor_email ?: 'Unknown account'));
    }

    public function getActorRoleLabelAttribute(): string
    {
        $role = Str::lower(trim((string) $this->actor_role));
        if ($role === '') {
            return '';
        }
        if ($role === 'jobseeker') {
            return 'Job Seeker';
        }

        return Str::title($role);
    }
}
