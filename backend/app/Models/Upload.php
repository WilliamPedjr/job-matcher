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
        'extracted_text',
        'experience_json',
        'job_seeker_hidden',
        'job_seeker_hidden_at',
        'size_bytes',
        'uploaded_at',
    ];

    protected $casts = [
        'matched_skills' => 'array',
        'missing_skills' => 'array',
        'experience_json' => 'array',
        'job_seeker_hidden' => 'boolean',
        'match_score' => 'float',
        'project_score' => 'float',
        'uploaded_at' => 'datetime',
        'job_seeker_hidden_at' => 'datetime',
    ];

    public function supportingFiles()
    {
        return $this->hasMany(SupportingFile::class, 'job_seeker_id', 'job_seeker_id');
    }

    public function jobSeeker()
    {
        return $this->belongsTo(JobSeeker::class);
    }
}
