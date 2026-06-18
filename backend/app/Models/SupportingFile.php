<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupportingFile extends Model
{
    use HasFactory;

    protected $table = 'job_seeker_supporting_files';

    public $timestamps = false;

    protected $fillable = [
        'job_seeker_id',
        'doc_type',
        'original_name',
        'saved_name',
        'file_path',
        'mime_type',
        'size_bytes',
        'uploaded_at',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'uploaded_at' => 'datetime',
    ];

    public function jobSeeker()
    {
        return $this->belongsTo(JobSeeker::class);
    }
}
