<?php

namespace App\Services;

use App\Models\PhotoScan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenAIVisionService
{
    protected string $apiKey;
    protected string $apiUrl;
    protected string $model;

    public function __construct()
    {
        $this->apiKey = (string) config('services.openai.api_key');
        $this->apiUrl = rtrim((string) config('services.openai.api_base'), '/') . '/chat/completions';
        $this->model  = (string) config('services.openai.model');
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
        $session = $photoScan->scanningSession;
        $inventoryMode = $session->device_info['inventory_mode'] ?? null;
        $prompt = $this->getPromptForPhotoType(
            $photoScan->photo_type,
            $session->session_type,
            $inventoryMode
        );

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
        ])->timeout(60)->post($this->apiUrl, [
            'model' => $this->model,
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
            'response_format' => ['type' => 'json_object'],
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

    private function getPromptForPhotoType(string $photoType, string $sessionType, ?string $inventoryMode = null): string
    {
        if ($inventoryMode === 'clothing') {
            return $this->getClothingPrompt($photoType);
        }

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

    private function getClothingPrompt(string $photoType): string
    {
        $sharedRules = ' This is a second-hand clothing inventory intake. Return ONLY valid JSON. '
            . 'Use null when a value is not clearly visible. Never invent a brand, size, material, flaw, or authenticity claim. '
            . 'Condition is only a visual suggestion and must be one of excellent, good, fair, poor, or broken.';

        $prompts = [
            'overview' => 'Analyze the FRONT view of this garment. Return: '
                . '{"garment_type":null,"category":null,"department":"women|men|unisex|kids|null",'
                . '"color":null,"pattern":null,"style_details":[],"suggested_title":null,'
                . '"condition":"excellent|good|fair|poor|broken|null","visible_flaws":[],"confidence":0.0}.',

            // The existing components photo type is reused as the back view for clothing sessions.
            'components' => 'Analyze the BACK view of this garment. Return: '
                . '{"garment_type":null,"category":null,"color":null,"pattern":null,'
                . '"style_details":[],"condition":"excellent|good|fair|poor|broken|null",'
                . '"visible_flaws":[],"confidence":0.0}.',

            'serial_label' => 'Read the brand, size, material, origin, and care labels exactly as visible. Return: '
                . '{"brand":null,"size_label":null,"material":null,"material_details":[],'
                . '"country_of_origin":null,"care_instructions":[],"label_text":[],"confidence":0.0}. '
                . 'Do not infer material or brand from the garment appearance.',

            'condition' => 'Inspect this close-up detail or flaw photo. Return: '
                . '{"condition":"excellent|good|fair|poor|broken|null","condition_notes":null,'
                . '"visible_flaws":[],"wear_level":"none|light|moderate|heavy|null",'
                . '"style_details":[],"confidence":0.0}.',
        ];

        return ($prompts[$photoType] ?? 'Analyze this clothing inventory photo and return relevant fields as JSON.')
            . $sharedRules;
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

        // Keep the complete structured clothing result in classification_results so
        // the review screen can merge suggestions from all four photos.
        $classification = [
            'device_type' => $data['device_type'] ?? $data['product_type'] ?? null,
            'category' => $data['category'] ?? null,
            'garment_type' => $data['garment_type'] ?? null,
            'department' => $data['department'] ?? null,
            'brand' => $data['brand'] ?? $data['manufacturer'] ?? null,
            'size_label' => $data['size_label'] ?? null,
            'color' => $data['color'] ?? null,
            'pattern' => $data['pattern'] ?? null,
            'material' => $data['material'] ?? null,
            'material_details' => $data['material_details'] ?? [],
            'country_of_origin' => $data['country_of_origin'] ?? null,
            'care_instructions' => $data['care_instructions'] ?? [],
            'style_details' => $data['style_details'] ?? [],
            'suggested_title' => $data['suggested_title'] ?? null,
            'condition_notes' => $data['condition_notes'] ?? null,
            'visible_flaws' => $data['visible_flaws'] ?? [],
            'wear_level' => $data['wear_level'] ?? null,
        ];

        // Ensure we have the required structure.
        return [
            'ocr_results' => ['text' => $data['label_text'] ?? $data['other_text'] ?? $data['text_extracted'] ?? []],
            'object_detection' => ['objects' => $data['visible_components'] ?? $data['objects_detected'] ?? $data['style_details'] ?? []],
            'classification_results' => $classification,
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
