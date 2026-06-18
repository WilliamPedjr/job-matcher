<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JobTemplate extends Model
{
    use HasFactory;

    protected $table = 'job_templates';

    protected $fillable = [
        'title',
        'description',
        'department',
        'location',
        'type',
        'required_skills',
        'minimum_education',
        'minimum_experience_years',
        'salary_min',
        'salary_max',
    ];
}
