import { z } from 'https://esm.sh/zod@3.23.8';
import { config } from './config.ts';
import { clamp, canonicalize } from './text.ts';

const entitySchema = z.object({
  type: z.enum(['paper', 'author', 'topic', 'method', 'dataset', 'metric']),
  canonicalName: z.string().min(1),
  rawName: z.string().min(1),
  confidence: z.number().min(0).max(1),
  source: z.enum(['claude', 'openalex', 'crossref', 'user']).default('claude'),
  externalId: z.string().optional(),
});

const relationSchema = z.object({
  relationType: z.enum(['authored_by', 'mentions', 'uses', 'evaluates_on', 'cites']),
  sourceEntityKey: z.string().min(1),
  targetEntityKey: z.string().min(1),
  confidence: z.number().min(0).max(1),
  source: z.enum(['claude', 'openalex', 'crossref', 'user']).default('claude'),
});

const extractionSchema = z.object({
  title: z.string().min(1),
  abstract: z.string().default(''),
  summary: z.string().default(''),
  year: z.number().int().optional(),
  venue: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.7),
  pageCount: z.number().int().optional(),
  citations: z.array(z.string()).default([]),
  entities: z.array(entitySchema).default([]),
  relations: z.array(relationSchema).default([]),
});

export type ClaudeExtraction = z.infer<typeof extractionSchema>;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function parseJsonFromText(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Claude response does not contain JSON object.');
  }

  return JSON.parse(raw.slice(start, end + 1));
}

export async function extractFromPdfWithClaude(fileBytes: ArrayBuffer): Promise<{
  extraction: ClaudeExtraction;
  inputTokens: number;
  outputTokens: number;
}> {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is missing.');
  }

  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-3-5-sonnet-latest';

  const prompt = [
    'You are extracting structured research metadata and knowledge graph candidates from a PDF.',
    'Return only strict JSON matching this schema:',
    '{',
    '  "title": string,',
    '  "abstract": string,',
    '  "summary": string,',
    '  "year": number | null,',
    '  "venue": string | null,',
    '  "confidence": number (0-1),',
    '  "pageCount": number | null,',
    '  "citations": string[],',
    '  "entities": [{"type":"paper|author|topic|method|dataset|metric","canonicalName":string,"rawName":string,"confidence":number,"source":"claude"}],',
    '  "relations": [{"relationType":"authored_by|mentions|uses|evaluates_on|cites","sourceEntityKey":string,"targetEntityKey":string,"confidence":number,"source":"claude"}]',
    '}',
    'For sourceEntityKey/targetEntityKey use canonicalName strings from entities.',
    'Do not include markdown fences or extra prose.',
  ].join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: arrayBufferToBase64(fileBytes),
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API failed: ${body}`);
  }

  const payload = await response.json();
  const textBlock = payload?.content?.find((entry: { type?: string }) => entry.type === 'text');
  const rawText = textBlock?.text;

  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Anthropic response did not include text content.');
  }

  const parsed = extractionSchema.parse(parseJsonFromText(rawText));

  const normalized = {
    ...parsed,
    confidence: clamp(parsed.confidence, 0, 1),
    entities: parsed.entities.map((entity) => ({
      ...entity,
      canonicalName: canonicalize(entity.canonicalName) || entity.canonicalName,
      rawName: entity.rawName,
      confidence: clamp(entity.confidence, 0, 1),
      source: 'claude' as const,
    })),
    relations: parsed.relations.map((relation) => ({
      ...relation,
      sourceEntityKey: canonicalize(relation.sourceEntityKey),
      targetEntityKey: canonicalize(relation.targetEntityKey),
      confidence: clamp(relation.confidence, 0, 1),
      source: 'claude' as const,
    })),
  } satisfies ClaudeExtraction;

  return {
    extraction: normalized,
    inputTokens: Number(payload?.usage?.input_tokens ?? 0),
    outputTokens: Number(payload?.usage?.output_tokens ?? 0),
  };
}
