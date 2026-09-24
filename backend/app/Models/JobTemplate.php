<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JobTemplate extends Model
{
    use HasFactory;

    protected $table = 'job_templates';

    protected $casts = [
        'deadline' => 'date',
        'skills_weight' => 'integer',
        'training_weight' => 'integer',
        'education_weight' => 'integer',
        'experience_weight' => 'integer',
        'eligibility_weight' => 'integer',
    ];

    protected $fillable = [
        'title',
        'description',
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
        'skills_weight',
        'training_weight',
        'education_weight',
        'experience_weight',
        'eligibility_weight',
        'salary_min',
        'salary_max',
    ];
}
