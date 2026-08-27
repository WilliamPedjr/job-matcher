<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class Job extends Model
{
    use HasFactory;

    protected $casts = [
        'deadline' => 'date',
    ];

    protected $fillable = [
        'template_id',
        'source',
        'title',
        'description',
        'status',
        'department',
        'job_position',
        'item_no',
        'location',
        'type',
        'deadline',
        'eligibility',
        'required_skills',
        'minimum_education',
        'minimum_experience_years',
        'application_threshold_score',
        'salary_min',
        'salary_max',
    ];

    public static function closeExpiredActiveJobs(): int
    {
        return static::query()
            ->whereRaw('LOWER(status) = ?', ['active'])
            ->whereNotNull('deadline')
            ->whereDate('deadline', '<=', Carbon::today())
            ->update(['status' => 'closed']);
    }

    public function deadlineIsMet(): bool
    {
        return $this->deadline !== null && $this->deadline->lessThanOrEqualTo(Carbon::today());
    }

    public function closeIfDeadlineIsMet(): bool
    {
        if (Str::lower((string) $this->status) !== 'active' || !$this->deadlineIsMet()) {
            return false;
        }

        $this->status = 'closed';
        return $this->save();
    }
}
