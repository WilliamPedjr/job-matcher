<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Experience extends Model
{
    use HasFactory;

    protected $table = 'job_seeker_experience';

    protected $fillable = [
        'job_seeker_id',
        'company_name',
        'position',
        'start_date',
        'end_date',
        'description',
    ];

    public function jobSeeker()
    {
        return $this->belongsTo(JobSeeker::class);
    }
}
