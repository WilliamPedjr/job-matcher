<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GlobalSkillCatalog extends Model
{
    use HasFactory;

    protected $table = 'global_skill_catalog';

    protected $fillable = [
        'skill',
    ];
}
