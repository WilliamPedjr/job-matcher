<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\ArchiveController;
use App\Http\Controllers\Api\EmployerController;
use App\Http\Controllers\Api\JobController;
use App\Http\Controllers\Api\LandingController;
use App\Http\Controllers\Api\JobSeekerController;
use App\Http\Controllers\Api\MatchController;
use App\Http\Controllers\Api\PdsController;
use App\Http\Controllers\Api\SkillController;
use App\Http\Controllers\Api\UploadController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'message' => 'LNU-HiRe API is running.',
    ]);
});

Route::post('/auth/verify-recaptcha', [AuthController::class, 'verifyRecaptcha']);
Route::middleware('api-session')->withoutMiddleware(['throttle:api'])->group(function () {
    Route::get('/auth/session', [AuthController::class, 'session']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/staff/register', [AuthController::class, 'staffRegister']);
    Route::post('/staff/login', [AuthController::class, 'staffLogin']);
    Route::post('/job-seekers/register', [AuthController::class, 'jobSeekerRegister']);
    Route::post('/job-seekers/login', [AuthController::class, 'jobSeekerLogin']);
    Route::post('/employers/login', [AuthController::class, 'employerLogin']);
});
Route::get('/activity-logs', [ActivityLogController::class, 'index']);
Route::post('/activity-logs', [ActivityLogController::class, 'store']);
Route::get('/staff/me', [AuthController::class, 'staffMe']);

Route::get('/archives', [ArchiveController::class, 'index']);
Route::post('/archives/{id}/restore-job', [ArchiveController::class, 'restoreJob']);

Route::get('/job-seekers/all', [JobSeekerController::class, 'indexAll']);
Route::get('/job-seekers/{id}', [JobSeekerController::class, 'show']);
Route::put('/job-seekers/{id}', [JobSeekerController::class, 'update']);
Route::put('/job-seekers/{id}/admin', [JobSeekerController::class, 'updateAdmin']);
Route::delete('/job-seekers/{id}', [JobSeekerController::class, 'destroy']);
Route::get('/job-seekers/{id}/resume', [JobSeekerController::class, 'resume']);
Route::post('/job-seekers/{id}/resume', [JobSeekerController::class, 'storeResume']);
Route::get('/job-seekers/{id}/resume/download', [JobSeekerController::class, 'downloadResume']);
Route::delete('/job-seekers/{id}/resume', [JobSeekerController::class, 'deleteResume']);
Route::get('/job-seekers/{id}/resume/match', [JobSeekerController::class, 'resumeMatch'])
    ->withoutMiddleware(['throttle:api']);
Route::post('/job-seekers/{id}/resume/match/batch', [JobSeekerController::class, 'resumeMatchBatch'])
    ->withoutMiddleware(['throttle:api']);
Route::get('/job-seekers/{id}/supporting', [JobSeekerController::class, 'supportingFiles']);
Route::post('/job-seekers/{id}/supporting', [JobSeekerController::class, 'storeSupportingFiles']);
Route::get('/job-seekers/{id}/supporting/{supportId}/download', [JobSeekerController::class, 'downloadSupportingFile']);
Route::delete('/job-seekers/{id}/supporting/{supportId}', [JobSeekerController::class, 'deleteSupportingFile']);
Route::post('/job-seekers/{id}/education', [JobSeekerController::class, 'storeEducation']);
Route::put('/job-seekers/{id}/education/{educationId}', [JobSeekerController::class, 'updateEducation']);
Route::delete('/job-seekers/{id}/education/{educationId}', [JobSeekerController::class, 'deleteEducation']);
Route::post('/job-seekers/{id}/experience', [JobSeekerController::class, 'storeExperience']);
Route::put('/job-seekers/{id}/experience/{experienceId}', [JobSeekerController::class, 'updateExperience']);
Route::delete('/job-seekers/{id}/experience/{experienceId}', [JobSeekerController::class, 'deleteExperience']);

Route::get('/employers', [EmployerController::class, 'index']);
Route::post('/employers', [EmployerController::class, 'store']);
Route::put('/employers/{id}', [EmployerController::class, 'update']);
Route::delete('/employers/{id}', [EmployerController::class, 'destroy']);

Route::get('/job-templates', [JobController::class, 'templates']);
Route::get('/jobs', [JobController::class, 'index'])
    ->withoutMiddleware(['throttle:api']);
Route::post('/jobs', [JobController::class, 'store']);
Route::get('/jobs/{id}', [JobController::class, 'show']);
Route::put('/jobs/{id}', [JobController::class, 'update']);
Route::delete('/jobs/{id}', [JobController::class, 'destroy']);
Route::put('/jobs/{id}/status', [JobController::class, 'status']);
Route::get('/jobs/{id}/skills', [JobController::class, 'skills']);
Route::put('/jobs/{id}/skills', [JobController::class, 'updateSkills']);

Route::get('/skills', [SkillController::class, 'index']);
Route::get('/skills/catalog', [SkillController::class, 'catalog']);

Route::get('/landing-summary', [LandingController::class, 'summary']);
Route::post('/pds/extract', [PdsController::class, 'extract']);
Route::post('/upload', [UploadController::class, 'store']);
Route::get('/uploads', [UploadController::class, 'index']);
Route::get('/uploads/{id}', [UploadController::class, 'show']);
Route::put('/uploads/{id}/reanalyze', [UploadController::class, 'reanalyze']);
Route::get('/uploads/{id}/download', [UploadController::class, 'download']);
Route::get('/uploads/{id}/supporting', [UploadController::class, 'supporting']);
Route::get('/uploads/{id}/supporting/{supportId}/download', [UploadController::class, 'supportingDownload']);
Route::get('/uploads/{id}/rating-summary/export', [UploadController::class, 'exportRatingSummary']);
Route::put('/uploads/{id}/evaluation', [UploadController::class, 'markForEvaluation']);
Route::put('/uploads/{id}/evaluation/cancel', [UploadController::class, 'cancelEvaluation']);
Route::post('/uploads/{id}/ratings', [UploadController::class, 'storeRating']);
Route::delete('/uploads/{id}', [UploadController::class, 'destroy']);
Route::put('/uploads/{id}/hide', [UploadController::class, 'hide']);

Route::post('/match', [MatchController::class, 'match']);
