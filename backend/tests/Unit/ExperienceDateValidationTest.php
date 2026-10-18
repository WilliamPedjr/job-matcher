<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\JobSeekerController;
use App\Models\Experience;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use ReflectionMethod;
use Tests\TestCase;

class ExperienceDateValidationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Already October 16 in Manila, while the application timezone is still October 15.
        Carbon::setTestNow(Carbon::parse('2026-10-15 16:30:00', 'UTC'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** @dataProvider experienceDates */
    public function test_experience_date_validation(array $input, ?array $existing, ?string $errorField): void
    {
        $controller = $this->app->make(JobSeekerController::class);
        $method = new ReflectionMethod($controller, 'validateExperience');
        $request = Request::create('/experience', $existing ? 'PUT' : 'POST', $input);

        try {
            $validated = $method->invoke($controller, $request, $existing ? new Experience($existing) : null);
            $this->assertNull($errorField, 'Expected invalid experience dates to be rejected.');
            $this->assertSame($input, $validated);
        } catch (ValidationException $exception) {
            $this->assertNotNull($errorField, 'Expected valid experience dates to be accepted.');
            $this->assertArrayHasKey($errorField, $exception->errors());
        }
    }

    public static function experienceDates(): array
    {
        return [
            'past dates' => [['start_date' => '2020-01-01', 'end_date' => '2025-12-31'], null, null],
            'today in Manila' => [['start_date' => '2026-10-16', 'end_date' => '2026-10-16'], null, null],
            'present is rejected' => [['start_date' => '2020-01-01', 'end_date' => 'Present'], null, 'end_date'],
            'missing end date' => [['start_date' => '2020-01-01'], null, 'end_date'],
            'empty end date' => [['start_date' => '2020-01-01', 'end_date' => ''], null, 'end_date'],
            'null end date' => [['start_date' => '2020-01-01', 'end_date' => null], null, 'end_date'],
            'future start' => [['start_date' => '2026-10-17', 'end_date' => '2026-10-16'], null, 'start_date'],
            'future end' => [['start_date' => '2020-01-01', 'end_date' => '2026-10-17'], null, 'end_date'],
            'reversed dates' => [['start_date' => '2025-12-31', 'end_date' => '2020-01-01'], null, 'end_date'],
            'invalid calendar date' => [['start_date' => '2025-02-29', 'end_date' => '2026-10-16'], null, 'start_date'],
            'invalid end date' => [['start_date' => '2020-01-01', 'end_date' => 'tomorrow'], null, 'end_date'],
            'update future start' => [
                ['start_date' => '2026-10-17'],
                ['start_date' => '2020-01-01', 'end_date' => 'Present'],
                'start_date',
            ],
            'update future end' => [
                ['end_date' => '2026-10-17'],
                ['start_date' => '2020-01-01', 'end_date' => '2025-12-31'],
                'end_date',
            ],
            'partial update preserves date order' => [
                ['end_date' => '2019-12-31'],
                ['start_date' => '2020-01-01', 'end_date' => 'Present'],
                'end_date',
            ],
            'update to present is rejected' => [
                ['end_date' => 'Present'],
                ['start_date' => '2020-01-01', 'end_date' => '2025-12-31'],
                'end_date',
            ],
            'replace legacy present with end date' => [
                ['end_date' => '2026-10-16'],
                ['start_date' => '2020-01-01', 'end_date' => 'Present'],
                null,
            ],
            'partial update keeps existing end date' => [
                ['position' => 'Officer'],
                ['start_date' => '2020-01-01', 'end_date' => '2025-12-31'],
                null,
            ],
            'update cannot clear end date' => [
                ['end_date' => null],
                ['start_date' => '2020-01-01', 'end_date' => '2025-12-31'],
                'end_date',
            ],
            'training behavior preserved' => [
                ['start_date' => '2026-10-17', 'end_date' => '2026-10-18', 'description' => 'Record Type: Training'],
                null,
                null,
            ],
        ];
    }
}
