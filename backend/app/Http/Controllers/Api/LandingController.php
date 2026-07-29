<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employer;
use App\Models\Job;
use App\Models\JobSeeker;
use App\Models\Upload;
use Illuminate\Http\JsonResponse;

class LandingController extends Controller
{
    public function summary(): JsonResponse
    {
        Job::closeExpiredActiveJobs();

        $jobsQuery = Job::query();
        $activeJobsQuery = Job::query()->whereRaw('LOWER(status) = ?', ['active']);

        $featuredJobs = $activeJobsQuery
            ->orderByDesc('id')
            ->limit(4)
            ->get()
            ->map(fn (Job $job) => $this->serializeJob($job))
            ->values();

        $activeJobs = $activeJobsQuery->count();
        $remoteOrHybridJobs = Job::query()
            ->where(function ($query) {
                $query->whereRaw('LOWER(location) LIKE ?', ['%remote%'])
                    ->orWhereRaw('LOWER(location) LIKE ?', ['%hybrid%']);
            })
            ->count();

        $applications = Upload::query()->count();
        $reviewedApplications = Upload::query()->whereNotNull('match_score')->count();
        $averageMatchScore = Upload::query()->whereNotNull('match_score')->avg('match_score');

        return response()->json([
            'summary' => [
                'total_jobs' => $jobsQuery->count(),
                'active_jobs' => $activeJobs,
                'total_job_seekers' => JobSeeker::query()->count(),
                'total_employers' => Employer::query()->count(),
                'total_applications' => $applications,
                'reviewed_applications' => $reviewedApplications,
                'remote_or_hybrid_jobs' => $remoteOrHybridJobs,
                'average_match_score' => round((float) ($averageMatchScore ?? 0), 2),
            ],
            'featured_jobs' => $featuredJobs,
        ]);
    }

    private function serializeJob(Job $job): array
    {
        return [
            'id' => $job->id,
            'title' => $job->title,
            'description' => $job->description,
            'status' => $job->status,
            'department' => $job->department,
            'job_position' => $job->job_position,
            'jobPosition' => $job->job_position,
            'item_no' => $job->item_no,
            'itemNo' => $job->item_no,
            'location' => $job->location,
            'type' => $job->type,
            'deadline' => optional($job->deadline)->format('Y-m-d') ?? $job->deadline,
            'eligibility' => $job->eligibility,
            'required_skills' => $job->required_skills,
            'minimum_education' => $job->minimum_education,
            'minimum_experience_years' => (int) $job->minimum_experience_years,
        ];
    }
}
