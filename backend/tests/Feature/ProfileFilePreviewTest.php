<?php

namespace Tests\Feature;

use App\Models\JobSeeker;
use App\Models\SupportingFile;
use App\Models\Upload;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProfileFilePreviewTest extends TestCase
{
    use DatabaseTransactions;

    private JobSeeker $seeker;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seeker = JobSeeker::create([
            'full_name' => 'Preview Applicant', 'email' => 'preview-'.Str::uuid().'@example.com',
            'password' => 'test-password',
        ]);
    }

    public function test_pds_pdf_opens_inline_and_remains_downloadable(): void
    {
        $content = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF";
        Storage::disk('local')->put('preview/pds.pdf', $content);
        Upload::create([
            'job_seeker_id' => $this->seeker->id, 'file_path' => 'preview/pds.pdf',
            'original_name' => 'Personal Data Sheet.pdf', 'mime_type' => 'application/pdf', 'uploaded_at' => now(),
        ]);
        $url = '/api/job-seekers/'.$this->seeker->id.'/resume';
        $this->get($url.'/view')->assertOk()->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Content-Disposition', 'inline; filename="Personal Data Sheet.pdf"')
            ->assertStreamedContent($content);
        $this->get($url.'/download')->assertOk()->assertDownload('Personal Data Sheet.pdf');
        $this->getJson($url)->assertOk()->assertJsonPath('resume.view_url', $url.'/view');
    }

    public function test_every_supporting_document_category_can_be_previewed(): void
    {
        $content = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5VQAAAAASUVORK5CYII=');
        Storage::disk('local')->put('preview/certificate.png', $content);
        foreach (['certificate', 'portfolio', 'transcript', 'others', 'recommendation', 'eligibility:Board'] as $type) {
            $doc = $this->document($type, 'preview/certificate.png');
            $this->get($this->url($doc))->assertOk()->assertHeader('Content-Type', 'image/png')
                ->assertHeader('Content-Disposition', 'inline; filename=certificate.png')->assertStreamedContent($content);
        }
        $this->getJson('/api/job-seekers/'.$this->seeker->id.'/supporting')->assertOk()->assertJsonCount(6, 'files');
    }

    public function test_missing_files_and_another_applicants_document_are_not_served(): void
    {
        $doc = $this->document('certificate', 'missing.png');
        $this->getJson($this->url($doc))->assertNotFound();
        $this->getJson('/api/job-seekers/'.$this->seeker->id.'/resume/view')->assertNotFound();
        $other = JobSeeker::create([
            'full_name' => 'Other Applicant', 'email' => 'preview-'.Str::uuid().'@example.com', 'password' => 'test-password',
        ]);
        Storage::disk('local')->put('preview/other.pdf', "%PDF-1.4\n%%EOF");
        $doc->update(['job_seeker_id' => $other->id, 'file_path' => 'preview/other.pdf']);
        $this->getJson($this->url($doc))->assertNotFound();
    }

    public function test_non_previewable_files_cannot_be_served_as_active_browser_content(): void
    {
        Storage::disk('local')->put('preview/document.html', '<html><script>alert(1)</script></html>');
        $doc = $this->document('others', 'preview/document.html');
        $this->getJson($this->url($doc))->assertStatus(415);
    }

    private function document(string $type, string $path): SupportingFile
    {
        return SupportingFile::create([
            'job_seeker_id' => $this->seeker->id, 'doc_type' => $type, 'original_name' => 'certificate.png',
            'saved_name' => 'certificate.png', 'file_path' => $path, 'mime_type' => 'image/png', 'uploaded_at' => now(),
        ]);
    }

    private function url(SupportingFile $doc): string
    {
        return '/api/job-seekers/'.$this->seeker->id.'/supporting/'.$doc->id.'/view';
    }
}
