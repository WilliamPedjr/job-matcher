<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\UploadController;
use App\Models\Upload;
use ReflectionMethod;
use Tests\TestCase;

class ClassificationLabelTest extends TestCase
{
    public function test_existing_uploads_display_lowly_qualified_without_rewriting_stored_data(): void
    {
        foreach (['Not Qualified', 'not qualified', ' Lowly Qualified '] as $value) {
            $upload = new Upload(['classification' => $value]);

            $this->assertSame('Lowly Qualified', $upload->classification);
            $this->assertSame('Lowly Qualified', $upload->toArray()['classification']);
            $this->assertSame($value, $upload->getAttributes()['classification']);
        }

        foreach (['Highly Qualified', 'Moderately Qualified', null] as $value) {
            $this->assertSame($value, (new Upload(['classification' => $value]))->classification);
        }
    }

    public function test_score_classifications_keep_the_existing_boundaries(): void
    {
        $controller = $this->app->make(UploadController::class);
        $method = new ReflectionMethod($controller, 'classificationForMatchScore');

        foreach ([0 => 'Lowly Qualified', 59 => 'Lowly Qualified', 60 => 'Moderately Qualified', 79 => 'Moderately Qualified', 80 => 'Highly Qualified', 100 => 'Highly Qualified'] as $score => $label) {
            $this->assertSame($label, $method->invoke($controller, $score));
        }
    }
}
