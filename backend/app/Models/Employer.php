<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Employer extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_name',
        'full_name',
        'email',
        'username',
        'phone',
        'password',
    ];

    protected $hidden = [
        'password',
    ];
}
