<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Experience extends Model
{
    use HasFactory;

    protected $table = 'job_seeker_experience';

    protected $fillable = [
        'job_seeker_id',
        'company_name',
        'position',
        'start_date',
        'end_date',
        'description',
        'skills',
    ];

    protected $casts = [
        'skills' => 'array',
    ];

    public static function normalizeSkills(array $skills): array
    {
        return collect($skills)
            ->map(fn ($skill) => \Illuminate\Support\Str::squish((string) $skill))
            ->filter(fn ($skill) => $skill !== '')
            ->unique(fn ($skill) => \Illuminate\Support\Str::lower($skill))
            ->values()->all();
    }

    public function jobSeeker()
    {
        return $this->belongsTo(JobSeeker::class);
    }
}
