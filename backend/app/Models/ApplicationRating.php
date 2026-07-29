<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ApplicationRating extends Model
{
    use HasFactory;

    protected $fillable = [
        'upload_id',
        'rater_name',
        'rater_email',
        'scores',
        'total_score',
        'percentage_score',
    ];

    protected $casts = [
        'scores' => 'array',
        'total_score' => 'integer',
        'percentage_score' => 'float',
    ];
}
