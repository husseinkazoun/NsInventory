// Tests for the OpenAI clothing-recognition provider.
//
// The provider's fetch and env are injected, so NOTHING here reaches OpenAI or
// spends credits. Run: deno test openai_test.ts

import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStringIncludes,
} from 'jsr:@std/assert@1'
import {
  createOpenAIVision,
  DEFAULT_VISION_MODEL,
  OpenAIConfigError,
  OpenAIHttpError,
  OpenAIMalformedError,
  OpenAINetworkError,
  OpenAIRefusalError,
  OpenAITimeoutError,
  type ClothingExtraction,
  type VisionImage,
} from './openai.ts'

const IMAGE: VisionImage = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  mimeType: 'image/jpeg',
}

/** A well-formed extraction with an UNKNOWN brand (null, flagged for review). */
function makeExtraction(
  over: Partial<ClothingExtraction> = {},
): ClothingExtraction {
  const c = (value: string | null, confidence = 0.9) => ({ value, confidence })
  return {
    garment_type: c('T-shirt'),
    brand: { value: null, confidence: 0.2, evidence: null },
    main_color: c('black'),
    secondary_color: c(null),
    pattern: c(null),
    size_label: c('M'),
    size_system: c(null),
    material_composition: c(null),
    label_text: c(null),
    style_code: c(null),
    suggested_title: c('Black T-shirt, size M'),
    visible_condition: 'good',
    flaws: [],
    style_keywords: ['casual', 'black'],
    warnings: [],
    needs_human_review: ['brand'],
    ...over,
  }
}

/** Raw /v1/responses envelope with the JSON text inside output[].content[]. */
function walkEnvelope(jsonText: string): unknown {
  return {
    id: 'resp_test',
    status: 'completed',
    output: [
      { type: 'reasoning', summary: [] },
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: jsonText, annotations: [] }],
      },
    ],
  }
}

/** Opportunistic top-level output_text shape (SDK-style convenience). */
function topLevelEnvelope(jsonText: string): unknown {
  return { id: 'resp_test', status: 'completed', output: [], output_text: jsonText }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

type Capture = { url?: string; init?: RequestInit; calls: number }

function stubFetch(response: Response | (() => Promise<Response>)): {
  fetch: typeof fetch
  capture: Capture
} {
  const capture: Capture = { calls: 0 }
  const fetchImpl = ((url: string | URL | Request, init?: RequestInit) => {
    capture.calls++
    capture.url = String(url)
    capture.init = init
    return typeof response === 'function'
      ? response()
      : Promise.resolve(response)
  }) as unknown as typeof fetch
  return { fetch: fetchImpl, capture }
}

const withKey = (name: string) =>
  name === 'OPENAI_API_KEY' ? 'sk-test-not-real' : undefined

// ── Success ────────────────────────────────────────────────────────────

Deno.test('parses a well-formed response (walk output[] shape)', async () => {
  const extraction = makeExtraction()
  const { fetch, capture } = stubFetch(
    jsonResponse(walkEnvelope(JSON.stringify(extraction))),
  )
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  const result = await analyze(IMAGE)
  assertEquals(result.garment_type.value, 'T-shirt')
  assertEquals(result.visible_condition, 'good')
  assertEquals(capture.calls, 1)
  assertStringIncludes(capture.url ?? '', '/v1/responses')
})

Deno.test('parses the top-level output_text fallback shape', async () => {
  const { fetch } = stubFetch(
    jsonResponse(topLevelEnvelope(JSON.stringify(makeExtraction()))),
  )
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  const result = await analyze(IMAGE)
  assertEquals(result.main_color.value, 'black')
})

Deno.test('does not invent an unknown brand', async () => {
  // The model returned brand=null; the provider must pass that through, never
  // fabricate a value.
  const { fetch } = stubFetch(
    jsonResponse(walkEnvelope(JSON.stringify(makeExtraction()))),
  )
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  const result = await analyze(IMAGE)
  assertEquals(result.brand.value, null)
  assert(result.needs_human_review.includes('brand'))
})

// ── Request shape ────────────────────────────────────────────────────────

Deno.test('sends the documented Responses API request shape', async () => {
  const { fetch, capture } = stubFetch(
    jsonResponse(walkEnvelope(JSON.stringify(makeExtraction()))),
  )
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  await analyze(IMAGE)
  const body = JSON.parse(String(capture.init?.body))
  assertEquals(body.model, DEFAULT_VISION_MODEL) // gpt-5.6-terra default
  assertEquals(body.reasoning.effort, 'none')
  assertEquals(body.store, false)
  assertEquals(body.text.format.type, 'json_schema')
  assertEquals(body.text.format.strict, true)
  const imagePart = body.input[0].content[1]
  assertEquals(imagePart.type, 'input_image')
  assertEquals(imagePart.detail, 'high')
  assertStringIncludes(imagePart.image_url, 'data:image/jpeg;base64,')
})

Deno.test('honours OPENAI_VISION_MODEL override, no silent switch', async () => {
  const { fetch, capture } = stubFetch(
    jsonResponse(walkEnvelope(JSON.stringify(makeExtraction()))),
  )
  const env = (n: string) =>
    n === 'OPENAI_API_KEY' ? 'sk-test' : n === 'OPENAI_VISION_MODEL' ? 'custom-model-x' : undefined
  const analyze = createOpenAIVision({ fetch, env, baseUrl: 'https://api.test' })
  await analyze(IMAGE)
  assertEquals(JSON.parse(String(capture.init?.body)).model, 'custom-model-x')
})

// ── Failures ─────────────────────────────────────────────────────────────

Deno.test('missing OPENAI_API_KEY throws before any fetch', async () => {
  const { fetch, capture } = stubFetch(jsonResponse({}, 200))
  const analyze = createOpenAIVision({
    fetch,
    env: () => undefined, // no key
    baseUrl: 'https://api.test',
  })
  await assertRejects(() => analyze(IMAGE), OpenAIConfigError)
  assertEquals(capture.calls, 0) // never reached the network
})

Deno.test('a timeout (AbortError) becomes OpenAITimeoutError', async () => {
  const { fetch } = stubFetch(() =>
    Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
  )
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  await assertRejects(() => analyze(IMAGE), OpenAITimeoutError)
})

Deno.test('a network failure becomes OpenAINetworkError', async () => {
  const { fetch } = stubFetch(() => Promise.reject(new TypeError('failed to fetch')))
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  await assertRejects(() => analyze(IMAGE), OpenAINetworkError)
})

Deno.test('a 429 becomes OpenAIHttpError carrying only error.message', async () => {
  const { fetch } = stubFetch(
    jsonResponse({ error: { message: 'Rate limit reached' } }, 429),
  )
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  const err = await analyze(IMAGE).catch((e) => e)
  assertInstanceOf(err, OpenAIHttpError)
  assertEquals(err.status, 429)
  assertEquals(err.providerMessage, 'Rate limit reached')
})

Deno.test('a provider 5xx becomes OpenAIHttpError', async () => {
  const { fetch } = stubFetch(jsonResponse({ error: { message: 'server error' } }, 503))
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  const err = await analyze(IMAGE).catch((e) => e)
  assertInstanceOf(err, OpenAIHttpError)
  assertEquals(err.status, 503)
})

Deno.test('an unavailable model surfaces the exact provider message (4xx)', async () => {
  const { fetch } = stubFetch(
    jsonResponse(
      { error: { message: "The model 'gpt-5.6-terra' does not exist or you do not have access." } },
      400,
    ),
  )
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  const err = await analyze(IMAGE).catch((e) => e)
  assertInstanceOf(err, OpenAIHttpError)
  assertEquals(err.status, 400)
  assertStringIncludes(err.providerMessage, 'does not exist')
})

Deno.test('malformed JSON text becomes OpenAIMalformedError', async () => {
  const { fetch } = stubFetch(jsonResponse(walkEnvelope('this is not json {')))
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  await assertRejects(() => analyze(IMAGE), OpenAIMalformedError)
})

Deno.test('a schema-mismatched body becomes OpenAIMalformedError', async () => {
  // Valid JSON, but missing required fields / wrong shape.
  const { fetch } = stubFetch(
    jsonResponse(walkEnvelope(JSON.stringify({ garment_type: 'oops-not-an-object' }))),
  )
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  await assertRejects(() => analyze(IMAGE), OpenAIMalformedError)
})

Deno.test('a refusal content part becomes OpenAIRefusalError', async () => {
  const { fetch } = stubFetch(
    jsonResponse({
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'refusal', refusal: 'I cannot help with that.' }],
        },
      ],
    }),
  )
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  await assertRejects(() => analyze(IMAGE), OpenAIRefusalError)
})

Deno.test('no message content becomes OpenAIMalformedError', async () => {
  const { fetch } = stubFetch(jsonResponse({ output: [], status: 'completed' }))
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  await assertRejects(() => analyze(IMAGE), OpenAIMalformedError)
})

// ── Malformed NESTED values ──────────────────────────────────────────────
// Strict Structured Outputs should make all of these impossible. They are
// rejected anyway: every one of them is persisted onto `photo_scans.extracted`
// and the scan-session summary, so a value that merely looks well-formed would
// be stored as genuine evidence about a real garment.

/** Runs the provider over an extraction whose nested shape has been corrupted. */
function analyzeWith(body: unknown) {
  const { fetch } = stubFetch(jsonResponse(walkEnvelope(JSON.stringify(body))))
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  return () => analyze(IMAGE)
}

Deno.test('a NaN confidence is rejected, not carried through as null', async () => {
  // JSON has no NaN literal, so a model emits it as a string/other non-number.
  // The older `typeof === 'number'` check also let a genuine NaN through, which
  // averaged to NaN and serialised to `null` — a field with no score at all.
  await assertRejects(
    analyzeWith(makeExtraction({ size_label: { value: 'M', confidence: 'high' } as never })),
    OpenAIMalformedError,
  )
})

Deno.test('an infinite confidence is rejected', async () => {
  const extraction = makeExtraction()
  // 1e999 parses back out of JSON as Infinity.
  const text = JSON.stringify(extraction).replace(
    '"main_color":{"value":"black","confidence":0.9}',
    '"main_color":{"value":"black","confidence":1e999}',
  )
  const { fetch } = stubFetch(jsonResponse(walkEnvelope(text)))
  const analyze = createOpenAIVision({ fetch, env: withKey, baseUrl: 'https://api.test' })
  await assertRejects(() => analyze(IMAGE), OpenAIMalformedError)
})

Deno.test('a brand whose evidence is not a string is rejected', async () => {
  await assertRejects(
    analyzeWith(
      makeExtraction({
        brand: { value: 'Nike', confidence: 0.9, evidence: { seen: 'swoosh' } } as never,
      }),
    ),
    OpenAIMalformedError,
  )
})

Deno.test('a flaw with a non-string location is rejected', async () => {
  await assertRejects(
    analyzeWith(
      makeExtraction({
        flaws: [{ location: { x: 1 }, severity: 'minor', description: 'small tear' }] as never,
      }),
    ),
    OpenAIMalformedError,
  )
})

Deno.test('a flaw with an unknown severity is rejected', async () => {
  await assertRejects(
    analyzeWith(
      makeExtraction({
        flaws: [{ location: 'left cuff', severity: 'catastrophic', description: 'tear' }] as never,
      }),
    ),
    OpenAIMalformedError,
  )
})

Deno.test('a non-string entry in needs_human_review is rejected', async () => {
  await assertRejects(
    analyzeWith(makeExtraction({ needs_human_review: ['brand', { field: 'size' }] as never })),
    OpenAIMalformedError,
  )
})

Deno.test('a non-string entry in style_keywords or warnings is rejected', async () => {
  await assertRejects(
    analyzeWith(makeExtraction({ style_keywords: [42] as never })),
    OpenAIMalformedError,
  )
  await assertRejects(
    analyzeWith(makeExtraction({ warnings: [null] as never })),
    OpenAIMalformedError,
  )
})

Deno.test('a well-formed flaw is still accepted', async () => {
  // The hardening must not reject legitimate output.
  const analyze = analyzeWith(
    makeExtraction({
      flaws: [
        { location: 'left cuff', severity: 'minor', description: 'small tear' },
        { location: 'collar', severity: 'moderate', description: 'fading' },
      ],
    }),
  )
  const result = await analyze()
  assertEquals(result.flaws.length, 2)
  assertEquals(result.flaws[0].severity, 'minor')
})
