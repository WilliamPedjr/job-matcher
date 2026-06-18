<?php

use App\Models\JobSeeker;
use Illuminate\Http\Request;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/me', function (Request $request) {
        $user = $request->user();
        $role = Str::lower(trim((string) ($user?->role ?? 'jobseeker')));

        $payload = [
            'id' => $user?->id,
            'name' => $user?->name,
            'email' => $user?->email,
            'role' => $role,
        ];

        if ($role === 'jobseeker' && $user?->email) {
            $jobSeeker = JobSeeker::query()
                ->whereRaw('LOWER(email) = ?', [Str::lower($user->email)])
                ->first();

            if ($jobSeeker) {
                $payload['jobSeekerId'] = $jobSeeker->id;
                $payload['jobSeekerProfile'] = [
                    'id' => $jobSeeker->id,
                    'fullName' => $jobSeeker->full_name,
                    'full_name' => $jobSeeker->full_name,
                    'email' => $jobSeeker->email,
                    'username' => $jobSeeker->username,
                    'phone' => $jobSeeker->phone,
                ];
            }
        }

        return response()->json($payload);
    });

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';

Route::view('/', 'app');
Route::view('/{any}', 'app')
    ->where('any', '^(?!(api|login|register|forgot-password|reset-password|verify-email|confirm-password|dashboard|profile)).*$');
