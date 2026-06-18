<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Education extends Model
{
    use HasFactory;

    protected $table = 'job_seeker_education';

    protected $fillable = [
        'job_seeker_id',
        'school_name',
        'degree',
        'start_year',
        'end_year',
        'description',
    ];

    public function jobSeeker()
    {
        return $this->belongsTo(JobSeeker::class);
    }
}
