<?php

namespace Tests\Feature;

use App\Models\Job;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class PartTimeSalaryTest extends TestCase
{
    use DatabaseTransactions;

    public function test_part_time_job_can_be_created_with_only_an_hourly_rate(): void
    {
        $payload = $this->payload('Part-time');
        $this->postJson('/api/jobs', $payload)->assertCreated()
            ->assertJsonPath('salaryMin', null)
            ->assertJsonPath('salaryMax', 150);
        $this->assertDatabaseHas('jobs', ['title' => $payload['title'], 'salary_min' => null, 'salary_max' => 150]);
    }

    public function test_changing_to_part_time_clears_a_previous_salary_grade(): void
    {
        $job = Job::create(['title' => 'Salary test '.Str::uuid(), 'description' => 'Test job', 'type' => 'Permanent', 'salary_min' => 15, 'salary_max' => 36619]);
        $this->putJson('/api/jobs/'.$job->id, [...$this->payload('Part-time'), 'salaryMin' => 15])
            ->assertOk()->assertJsonPath('salaryMin', null)->assertJsonPath('salaryMax', 150);
        $this->assertNull($job->fresh()->salary_min);
    }

    public function test_other_employment_types_keep_the_salary_grade_and_monthly_salary(): void
    {
        $this->postJson('/api/jobs', [...$this->payload('Permanent'), 'salaryMin' => 15, 'salaryMax' => 36619])
            ->assertCreated()->assertJsonPath('salaryMin', 15)->assertJsonPath('salaryMax', 36619);
    }

    public function test_contract_of_service_uses_only_an_hourly_rate(): void
    {
        $payload = $this->payload('Contract of Service');
        $this->postJson('/api/jobs', $payload)->assertCreated()
            ->assertJsonPath('salaryMin', null)->assertJsonPath('salaryMax', 150);
        $this->assertDatabaseHas('jobs', ['title' => $payload['title'], 'salary_min' => null, 'salary_max' => 150]);
    }

    public function test_changing_to_contract_of_service_discards_the_previous_salary_grade(): void
    {
        $job = Job::create(['title' => 'Salary test '.Str::uuid(), 'description' => 'Test job', 'type' => 'Permanent', 'salary_min' => 15, 'salary_max' => 36619]);
        $this->putJson('/api/jobs/'.$job->id, [...$this->payload('Contract of Service'), 'salaryMin' => 15])
            ->assertOk()->assertJsonPath('salaryMin', null)->assertJsonPath('salaryMax', 150);
        $this->assertNull($job->fresh()->salary_min);
    }

    public function test_internship_can_be_created_without_a_salary_or_grade(): void
    {
        $payload = $this->payload('Internship');
        unset($payload['salaryMax']);
        $this->postJson('/api/jobs', $payload)->assertCreated()
            ->assertJsonPath('salaryMin', null)->assertJsonPath('salaryMax', null);
        $this->assertDatabaseHas('jobs', ['title' => $payload['title'], 'salary_min' => null, 'salary_max' => null]);
    }

    public function test_changing_to_internship_clears_existing_salary_values(): void
    {
        $job = Job::create(['title' => 'Salary test '.Str::uuid(), 'description' => 'Test job', 'type' => 'Permanent', 'salary_min' => 15, 'salary_max' => 36619]);
        $this->putJson('/api/jobs/'.$job->id, [...$this->payload('Internship'), 'salaryMin' => 15])
            ->assertOk()->assertJsonPath('salaryMin', null)->assertJsonPath('salaryMax', null);
        $this->assertNull($job->fresh()->salary_min);
        $this->assertNull($job->fresh()->salary_max);
    }

    private function payload(string $type): array
    {
        return ['title' => 'Salary test '.Str::uuid(), 'description' => 'Test job', 'type' => $type, 'salaryMax' => 150];
    }
}
