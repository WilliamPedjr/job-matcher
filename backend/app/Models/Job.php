<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Job extends Model
{
    use HasFactory;

    protected $fillable = [
        'template_id',
        'source',
        'title',
        'description',
        'status',
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
