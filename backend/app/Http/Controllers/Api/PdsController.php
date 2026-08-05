<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PdsExtractionService;
use App\Services\TextExtractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PdsController extends Controller
{
    public function __construct(
        private readonly TextExtractionService $textExtractionService,
        private readonly PdsExtractionService $pdsExtractionService
    ) {
    }

    public function extract(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:6144'],
        ]);

        $file = $data['file'];
        $path = $file->getRealPath();
        if (!$path) {
            return response()->json(['message' => 'Could not read uploaded PDS file.'], 422);
        }

        $text = $this->textExtractionService->extract($path, $file->getMimeType());
        $format = $this->pdsExtractionService->format($text);

        return response()->json([
            'detected' => $format['detected'] ?? false,
            'pds_format' => $format,
            'extracted_text' => $text,
        ]);
    }
}
