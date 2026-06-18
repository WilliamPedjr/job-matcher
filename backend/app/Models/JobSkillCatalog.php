<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JobSkillCatalog extends Model
{
    use HasFactory;

    protected $table = 'job_skill_catalog';

    protected $fillable = [
        'job_id',
        'skill',
    ];

    public $timestamps = false;
}
