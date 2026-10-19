<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Upload extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'job_seeker_id',
        'job_seeker_id_number',
        'job_id',
        'job_position_type',
        'name',
        'email',
        'phone',
        'applied_job_title',
        'original_name',
        'saved_name',
        'file_path',
        'mime_type',
        'classification',
        'match_score',
        'skills_match_score',
        'project_score',
        'education_match_score',
        'experience_match_score',
        'matched_job_title',
        'matched_skills',
        'missing_skills',
        'education_text',
        'experience_text',
        'extracted_text',
        'education_json',
        'experience_json',
        'summary_text',
        'resume_summary',
        'job_seeker_hidden',
        'job_seeker_hidden_at',
        'evaluation_status',
        'evaluation_started_at',
        'interview_date',
        'interview_place',
        'interview_time',
        'interview_preparation_notes',
        'demonstration_date',
        'demonstration_time',
        'demonstration_place',
        'demonstration_preparation_notes',
        'examination_date',
        'examination_score',
        'size_bytes',
        'uploaded_at',
    ];

    protected $casts = [
        'matched_skills' => 'array',
        'missing_skills' => 'array',
        'education_json' => 'array',
        'experience_json' => 'array',
        'resume_summary' => 'array',
        'job_seeker_hidden' => 'boolean',
        'job_id' => 'integer',
        'match_score' => 'float',
        'skills_match_score' => 'float',
        'project_score' => 'float',
        'education_match_score' => 'float',
        'experience_match_score' => 'float',
        'uploaded_at' => 'datetime',
        'job_seeker_hidden_at' => 'datetime',
        'evaluation_started_at' => 'datetime',
        'interview_date' => 'date',
        'demonstration_date' => 'date',
        'examination_date' => 'date',
        'examination_score' => 'float',
    ];

    public function getClassificationAttribute($value): ?string
    {
        if ($value === null) {
            return null;
        }

        $classification = trim((string) $value);

        return in_array(strtolower($classification), ['not qualified', 'lowly qualified'], true)
            ? 'Lowly Qualified'
            : $classification;
    }

    public function scopeApplications(Builder $query): Builder
    {
        return $query->where(function (Builder $query) {
            $query
                ->whereNotNull('job_id')
                ->orWhere(function (Builder $query) {
                    $query
                        ->whereNotNull('applied_job_title')
                        ->where('applied_job_title', '<>', '');
                });
        });
    }

    public function scopeCurrentApplications(Builder $query): Builder
    {
        return $query->applications()
            ->where(function (Builder $query) {
                $query->where('job_seeker_hidden', false)
                    ->orWhereNull('job_seeker_hidden');
            })
            ->where(function (Builder $query) {
                $query->whereNull('evaluation_status')
                    ->orWhereRaw('LOWER(TRIM(evaluation_status)) <> ?', ['cancelled']);
            });
    }

    public function scopeRecruitmentRecords(Builder $query): Builder
    {
        return $query->where(function (Builder $query) {
            $query->applications()
                ->orWhereHas('ratings')
                ->orWhereNotNull('evaluation_started_at')
                ->orWhereNotNull('interview_date')
                ->orWhereNotNull('demonstration_date')
                ->orWhereNotNull('examination_date')
                ->orWhereNotNull('examination_score')
                ->orWhereRaw('LOWER(TRIM(evaluation_status)) IN (?, ?, ?, ?, ?, ?, ?)', [
                    'reviewed', 'shortlisted', 'interview', 'for_evaluation', 'rated', 'hired', 'rejected',
                ]);
        });
    }

    public function supportingFiles()
    {
        return $this->hasMany(SupportingFile::class, 'job_seeker_id', 'job_seeker_id');
    }

    public function jobSeeker()
    {
        return $this->belongsTo(JobSeeker::class);
    }

    public function job()
    {
        return $this->belongsTo(Job::class);
    }

    public function ratings()
    {
        return $this->hasMany(ApplicationRating::class);
    }
}
