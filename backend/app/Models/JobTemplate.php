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
        'salary_min',
        'salary_max',
    ];
}
