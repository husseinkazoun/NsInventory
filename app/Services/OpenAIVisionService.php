<?php

namespace App\Services;

use App\Models\PhotoScan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenAIVisionService
{
    protected $apiKey;
    protected $apiUrl;

    public function __construct()
    {
        $this->apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY');
        $this->apiUrl = 'https://api.openai.com/v1/chat/completions';
    }

    public function analyzePhoto(PhotoScan $photoScan): array
    {
        if (!$this->apiKey) {
            throw new \Exception('OpenAI API key not configured');
        }

        $imagePath = Storage::disk('public')->path($photoScan->photo_path);
        
        if (!file_exists($imagePath)) {
            throw new \Exception('Photo file not found: ' . $photoScan->photo_path);
        }

        $imageData = base64_encode(file_get_contents($imagePath));
        $prompt = $this->getPromptForPhotoType($photoScan->photo_type, $photoScan->scanningSession->session_type);

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
        ])->timeout(60)->post($this->apiUrl, [
            'model' => 'gpt-4-vision-preview',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => $prompt
                        ],
                        [
                            'type' => 'image_url',
                            'image_url' => [
                                'url' => "data:image/jpeg;base64,{$imageData}",
                                'detail' => 'high'
                            ]
                        ]
                    ]
                ]
            ],
            'max_tokens' => 1000,
            'temperature' => 0.1
        ]);

        if (!$response->successful()) {
            throw new \Exception('OpenAI API request failed: ' . $response->body());
        }

        $responseData = $response->json();
        $content = $responseData['choices'][0]['message']['content'] ?? '';

        return $this->parseResponse($content, $photoScan->photo_type);
    }

    private function getPromptForPhotoType(string $photoType, string $sessionType): string
    {
        $basePrompts = [
            'lab_asset' => [
                'overview' => 'Analyze this computer/lab equipment photo. Extract device information and return ONLY a JSON object with these exact fields: {"device_type": "string", "manufacturer": "string", "model": "string", "condition": "excellent|good|fair|poor|broken", "confidence": 0.0-1.0, "visible_components": ["array"], "missing_components": [{"component_type": "string", "component_name": "string", "required": true/false}]}',
                
                'serial_label' => 'Extract all text from labels and stickers in this photo. Focus on serial numbers, model numbers, part numbers. Return ONLY a JSON object: {"serial_number": "string", "model": "string", "manufacturer": "string", "part_number": "string", "other_text": ["array"], "confidence": 0.0-1.0}',
                
                'components' => 'Identify computer components and missing items in this photo. Return ONLY a JSON object: {"visible_components": ["power_cable", "network_cable", "mouse", "keyboard", "monitor", "etc"], "missing_components": [{"component_type": "power_cable", "component_name": "Power Cable", "required": true, "estimated_cost": 25.00}], "confidence": 0.0-1.0}',
                
                'condition' => 'Assess the physical condition of this equipment. Return ONLY a JSON object: {"condition": "excellent|good|fair|poor|broken", "damage_notes": ["array of damage descriptions"], "wear_level": "none|light|moderate|heavy", "functional_status": "working|needs_repair|broken", "confidence": 0.0-1.0}'
            ],
            'regular_product' => [
                'overview' => 'Analyze this product photo. Return ONLY a JSON object: {"product_type": "string", "brand": "string", "model": "string", "condition": "excellent|good|fair|poor|broken", "confidence": 0.0-1.0}',
                
                'serial_label' => 'Extract text from labels. Return ONLY a JSON object: {"serial_number": "string", "model": "string", "brand": "string", "other_text": ["array"], "confidence": 0.0-1.0}',
                
                'components' => 'Check if this product is complete. Return ONLY a JSON object: {"complete": true/false, "missing_parts": ["array"], "confidence": 0.0-1.0}',
                
                'condition' => 'Assess condition. Return ONLY a JSON object: {"condition": "excellent|good|fair|poor|broken", "notes": ["array"], "confidence": 0.0-1.0}'
            ]
        ];

        return $basePrompts[$sessionType][$photoType] ?? 'Analyze this image and return relevant information as JSON.';
    }

    private function parseResponse(string $response, string $photoType): array
    {
        // Clean the response to extract JSON
        $response = trim($response);
        
        // Remove markdown code blocks if present
        $response = preg_replace('/```json\s*/', '', $response);
        $response = preg_replace('/```\s*$/', '', $response);
        
        // Try to decode JSON
        $data = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::warning('Failed to parse OpenAI response as JSON', [
                'response' => $response,
                'error' => json_last_error_msg()
            ]);
            
            // Fallback: try to extract basic information using regex
            $data = $this->extractBasicInfo($response, $photoType);
        }

        // Ensure we have the required structure
        return [
            'ocr_results' => $data['other_text'] ?? $data['text_extracted'] ?? [],
            'object_detection' => $data['visible_components'] ?? $data['objects_detected'] ?? [],
            'classification_results' => [
                'device_type' => $data['device_type'] ?? $data['product_type'] ?? null,
                'category' => $data['category'] ?? null
            ],
            'confidence_score' => $data['confidence'] ?? 0.5,
            'extracted_serial' => $data['serial_number'] ?? null,
            'extracted_model' => $data['model'] ?? null,
            'extracted_manufacturer' => $data['manufacturer'] ?? $data['brand'] ?? null,
            'detected_condition' => $data['condition'] ?? null,
            'missing_components' => $data['missing_components'] ?? []
        ];
    }

    private function extractBasicInfo(string $response, string $photoType): array
    {
        // Fallback extraction using regex patterns
        $data = [];
        
        // Extract serial numbers
        if (preg_match('/serial[:\s]*([A-Z0-9\-]+)/i', $response, $matches)) {
            $data['serial_number'] = $matches[1];
        }
        
        // Extract model numbers
        if (preg_match('/model[:\s]*([A-Z0-9\-\s]+)/i', $response, $matches)) {
            $data['model'] = trim($matches[1]);
        }
        
        // Extract manufacturer/brand
        if (preg_match('/(dell|hp|apple|lenovo|asus|acer|microsoft|intel|amd)/i', $response, $matches)) {
            $data['manufacturer'] = ucfirst(strtolower($matches[1]));
        }
        
        // Extract condition
        if (preg_match('/(excellent|good|fair|poor|broken)/i', $response, $matches)) {
            $data['condition'] = strtolower($matches[1]);
        }
        
        $data['confidence'] = 0.3; // Lower confidence for fallback extraction
        
        return $data;
    }
}

