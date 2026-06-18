<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JobSeeker extends Model
{
    use HasFactory;

    protected $fillable = [
        'full_name',
        'email',
        'username',
        'phone',
        'password',
    ];

    protected $hidden = [
        'password',
    ];

    public function educations()
    {
        return $this->hasMany(Education::class);
    }

    public function experiences()
    {
        return $this->hasMany(Experience::class);
    }

    public function uploads()
    {
        return $this->hasMany(Upload::class);
    }

    public function supportingFiles()
    {
        return $this->hasMany(SupportingFile::class);
    }
}
