<?php

namespace Tests\Feature;

use App\Models\GlobalSkillCatalog;
use App\Models\Job;
use App\Models\JobSkillCatalog;
use App\Models\JobTemplate;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class SkillCatalogVisibilityTest extends TestCase
{
    use DatabaseTransactions;

    private const MARKERS = ['__MATCH_ALL__', '__MATCH_MODERATE__', '__MATCH_NOT_QUALIFIED__', '__MATCH_55_PERCENT__'];
    private const TRAINING_REQUIREMENTS = [
        '16 hours relevant training',
        '4 hours relevant training',
        '40 hours of supervisory/management learning and development intervention undertaken within the last five years reckoned from the date of assessment',
    ];

    public function test_global_and_fallback_catalogs_hide_markers_and_training_requirements_and_keep_real_skills(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        foreach ([...self::MARKERS, ...self::TRAINING_REQUIREMENTS] as $marker) {
            GlobalSkillCatalog::firstOrCreate(['skill' => $marker]);
        }
        $skill = 'Visible Skill '.Str::uuid();
        GlobalSkillCatalog::create(['skill' => $skill]);
        GlobalSkillCatalog::firstOrCreate(['skill' => 'Training Design']);

        foreach (['/api/skills', '/api/skills/catalog?title='.urlencode('Missing Job '.Str::uuid())] as $url) {
            $skills = $this->getJson($url)->assertOk()->json('skills');
            $this->assertContains($skill, $skills);
            $this->assertContains('Training Design', $skills);
            foreach ([...self::MARKERS, ...self::TRAINING_REQUIREMENTS] as $marker) {
                $this->assertNotContains($marker, $skills);
                $this->assertDatabaseHas('global_skill_catalog', ['skill' => $marker]);
            }
        }
    }

    public function test_job_catalog_hides_markers_without_changing_matching_requirements(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $job = Job::create([
            'title' => 'Catalog Visibility '.Str::uuid(), 'description' => 'Catalog visibility test.',
            'required_skills' => '__MATCH_ALL__', 'status' => 'active',
        ]);
        foreach ([...self::MARKERS, ...self::TRAINING_REQUIREMENTS, 'Communication', 'Training Design'] as $skill) {
            JobSkillCatalog::create(['job_id' => $job->id, 'skill' => $skill]);
        }

        $this->getJson('/api/skills/catalog?title='.urlencode($job->title))->assertOk()
            ->assertJsonPath('skills', ['Communication', 'Training Design']);
        $this->assertSame('__MATCH_ALL__', $job->fresh()->required_skills);
        $this->assertSame(9, JobSkillCatalog::where('job_id', $job->id)->count());
    }

    public function test_templates_have_no_prefilled_skills_while_posted_jobs_keep_their_skills(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $template = JobTemplate::create([
            'title' => 'Blank Skills Template '.Str::uuid(), 'description' => 'Reusable job details.',
            'required_skills' => 'Accounting, Budgeting',
        ]);
        $job = Job::create([
            'title' => $template->title, 'description' => 'Published job details.',
            'required_skills' => 'Communication, Research', 'status' => 'active',
        ]);

        $templates = $this->getJson('/api/job-templates')->assertOk()->json();
        $record = collect($templates)->firstWhere('id', $template->id);
        $this->assertNotNull($record);
        $this->assertSame('', $record['requiredSkills']);
        $this->assertSame('', $record['required_skills']);
        $this->assertSame([], $record['skills']);
        $this->getJson('/api/jobs/'.$job->id)->assertOk()
            ->assertJsonPath('requiredSkills', 'Communication, Research');
    }
}
