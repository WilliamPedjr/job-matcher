<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Upload extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'job_seeker_id',
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
        'project_score',
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
        'match_score' => 'float',
        'project_score' => 'float',
        'uploaded_at' => 'datetime',
        'job_seeker_hidden_at' => 'datetime',
        'evaluation_started_at' => 'datetime',
    ];

    public function supportingFiles()
    {
        return $this->hasMany(SupportingFile::class, 'job_seeker_id', 'job_seeker_id');
    }

    public function jobSeeker()
    {
        return $this->belongsTo(JobSeeker::class);
    }

    public function ratings()
    {
        return $this->hasMany(ApplicationRating::class);
    }
}
