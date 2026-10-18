<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class JobSeeker extends Authenticatable
{
    use HasFactory, Notifiable;

    public const DELETION_BLOCK_REASON = 'This applicant account cannot be deleted because it is linked to applications, evaluations, or recruitment process records.';

    protected static function booted(): void
    {
        static::deleting(function (JobSeeker $jobSeeker) {
            if ($jobSeeker->hasRecruitmentRecords(true)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'account' => self::DELETION_BLOCK_REASON,
                ]);
            }
        });
    }

    public function hasRecruitmentRecords(bool $fresh = false): bool
    {
        $attributes = $this->getAttributes();
        if (!$fresh && array_key_exists('has_recruitment_records', $attributes)
            && array_key_exists('has_linked_supporting_records', $attributes)) {
            return (bool) $attributes['has_recruitment_records'] || (bool) $attributes['has_linked_supporting_records'];
        }

        return $this->uploads()->recruitmentRecords()->exists()
            || $this->supportingFiles()->whereNotNull('upload_id')->exists();
    }

    protected $fillable = [
        'id_number',
        'full_name',
        'email',
        'email_verified_at',
        'email_verification_token',
        'email_verification_sent_at',
        'username',
        'phone',
        'status',
        'address',
        'about_text',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'email_verification_token',
    ];

    protected $casts = [
        'password' => 'hashed',
        'email_verified_at' => 'datetime',
        'email_verification_sent_at' => 'datetime',
    ];

    public function educations()
    {
        return $this->hasMany(Education::class);
    }

    public function experiences()
    {
        return $this->hasMany(Experience::class);
    }

    public function combinedSkills(): array
    {
        $this->loadMissing('experiences');

        return Experience::normalizeSkills($this->experiences
            ->flatMap(fn (Experience $experience) => $experience->skills ?? [])
            ->all());
    }

    public function uploads()
    {
        return $this->hasMany(Upload::class);
    }

    public function supportingFiles()
    {
        return $this->hasMany(SupportingFile::class);
    }
}
