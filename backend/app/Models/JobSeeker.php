<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class JobSeeker extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'id_number',
        'full_name',
        'email',
        'username',
        'phone',
        'status',
        'address',
        'about_text',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed',
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
