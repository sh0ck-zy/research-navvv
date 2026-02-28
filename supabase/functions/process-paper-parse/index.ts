import { z } from 'https://esm.sh/zod@3.23.8';
import { extractFromPdfWithClaude } from '../_shared/claude.ts';
import { handleOptions, withJson } from '../_shared/cors.ts';
import { config } from '../_shared/config.ts';
import { invokeEdgeFunction, monthStartIso } from '../_shared/pipeline.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { canonicalize } from '../_shared/text.ts';

const requestSchema = z.object({
  paperId: z.string().uuid(),
});

const SONNET_INPUT_COST_PER_MILLION = 3;
const SONNET_OUTPUT_COST_PER_MILLION = 15;
const LOW_CONFIDENCE_THRESHOLD = 0.55;

async function getMonthlySpend(service: ReturnType<typeof createServiceClient>, ownerId: string): Promise<number> {
  const { data, error } = await service
    .from('ai_usage_daily')
    .select('estimated_cost_usd')
    .eq('owner_id', ownerId)
    .gte('day', monthStartIso().slice(0, 10));

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
}

async function trackAiUsage(
  service: ReturnType<typeof createServiceClient>,
  ownerId: string,
  inputTokens: number,
  outputTokens: number
) {
  const day = new Date().toISOString().slice(0, 10);
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * SONNET_INPUT_COST_PER_MILLION +
    (outputTokens / 1_000_000) * SONNET_OUTPUT_COST_PER_MILLION;

  const { data: existing, error: existingError } = await service
    .from('ai_usage_daily')
    .select('input_tokens, output_tokens, estimated_cost_usd')
    .eq('owner_id', ownerId)
    .eq('day', day)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    const { error: insertError } = await service.from('ai_usage_daily').insert({
      owner_id: ownerId,
      day,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: estimatedCostUsd,
    });

    if (insertError) {
      throw insertError;
    }

    return;
  }

  const { error: updateError } = await service
    .from('ai_usage_daily')
    .update({
      input_tokens: Number(existing.input_tokens ?? 0) + inputTokens,
      output_tokens: Number(existing.output_tokens ?? 0) + outputTokens,
      estimated_cost_usd: Number(existing.estimated_cost_usd ?? 0) + estimatedCostUsd,
    })
    .eq('owner_id', ownerId)
    .eq('day', day);

  if (updateError) {
    throw updateError;
  }
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);

  if (optionsResponse) {
    return optionsResponse;
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${config.supabaseServiceRoleKey}`) {
    return withJson({ error: 'Unauthorized pipeline call.' }, 401, request);
  }

  let paperId: string | null = null;

  try {
    const payload = requestSchema.parse(await request.json());
    paperId = payload.paperId;
    const service = createServiceClient();

    const { data: paper, error: paperError } = await service
      .from('papers')
      .select('id, owner_id, storage_path, processing_attempts')
      .eq('id', payload.paperId)
      .single();

    if (paperError || !paper) {
      return withJson({ error: 'Paper not found.' }, 404, request);
    }

    const monthlySpend = await getMonthlySpend(service, paper.owner_id);

    if (monthlySpend >= config.aiMonthlyCapUsd) {
      await service
        .from('papers')
        .update({
          status: 'failed',
          processing_error: `AI processing cap reached ($${config.aiMonthlyCapUsd}/month).`,
        })
        .eq('id', paper.id);

      return withJson({ error: 'Monthly AI cap reached.' }, 402, request);
    }

    const { error: parseStageError } = await service
      .from('papers')
      .update({
        status: 'processing',
        processing_stage: 'parse',
        processing_error: null,
        processing_attempts: Number(paper.processing_attempts ?? 0) + 1,
      })
      .eq('id', paper.id);

    if (parseStageError) {
      throw parseStageError;
    }

    const { data: file, error: downloadError } = await service.storage.from('papers').download(paper.storage_path);

    if (downloadError || !file) {
      throw new Error(downloadError?.message ?? 'Unable to download source PDF.');
    }

    const fileBytes = await file.arrayBuffer();
    const { extraction, inputTokens, outputTokens } = await extractFromPdfWithClaude(fileBytes);

    await trackAiUsage(service, paper.owner_id, inputTokens, outputTokens);

    const { error: relationDeleteError } = await service.from('paper_relations').delete().eq('paper_id', paper.id);
    if (relationDeleteError) {
      throw relationDeleteError;
    }

    const { error: entityDeleteError } = await service.from('paper_entities').delete().eq('paper_id', paper.id);
    if (entityDeleteError) {
      throw entityDeleteError;
    }

    let insertedEntities: Array<{ id: string; canonical_name: string }> = [];
    if (extraction.entities.length > 0) {
      const { data: inserted, error: entityInsertError } = await service
        .from('paper_entities')
        .insert(
          extraction.entities.map((entity) => ({
            paper_id: paper.id,
            type: entity.type,
            canonical_name: canonicalize(entity.canonicalName),
            raw_name: entity.rawName,
            confidence: entity.confidence,
            source: entity.source,
            external_id: entity.externalId ?? null,
          }))
        )
        .select('id, canonical_name');

      if (entityInsertError) {
        throw new Error(entityInsertError.message);
      }

      insertedEntities = (inserted ?? []) as Array<{ id: string; canonical_name: string }>;
    }

    const entityMap = new Map<string, string>();
    for (const entity of insertedEntities) {
      entityMap.set(String(entity.canonical_name), String(entity.id));
    }

    const relationsPayload = extraction.relations
      .map((relation) => {
        const sourceEntityId = entityMap.get(canonicalize(relation.sourceEntityKey));
        const targetEntityId = entityMap.get(canonicalize(relation.targetEntityKey));

        if (!sourceEntityId || !targetEntityId) {
          return null;
        }

        return {
          paper_id: paper.id,
          relation_type: relation.relationType,
          source_entity_id: sourceEntityId,
          target_entity_id: targetEntityId,
          confidence: relation.confidence,
          source: relation.source,
        };
      })
      .filter((relation): relation is NonNullable<typeof relation> => relation !== null);

    if (relationsPayload.length > 0) {
      const { error: relationInsertError } = await service.from('paper_relations').insert(relationsPayload);

      if (relationInsertError) {
        throw new Error(relationInsertError.message);
      }
    }

    const { error: extractionInsertError } = await service.from('paper_extractions').insert({
      paper_id: paper.id,
      raw_json: extraction,
      confidence: extraction.confidence,
      model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-3-5-sonnet-latest',
      token_usage: {
        inputTokens,
        outputTokens,
      },
    });

    if (extractionInsertError) {
      throw new Error(extractionInsertError.message);
    }

    const { error: paperUpdateError } = await service
      .from('papers')
      .update({
        title: extraction.title,
        abstract: extraction.abstract,
        summary: extraction.summary,
        year: extraction.year ?? null,
        venue: extraction.venue ?? null,
        page_count: extraction.pageCount ?? null,
        citations_json: extraction.citations,
        status: extraction.confidence < LOW_CONFIDENCE_THRESHOLD ? 'needs_review' : 'processing',
        processing_stage: extraction.confidence < LOW_CONFIDENCE_THRESHOLD ? 'done' : 'enrich',
        processing_error:
          extraction.confidence < LOW_CONFIDENCE_THRESHOLD
            ? 'Low extraction confidence. Please review and correct this paper.'
            : null,
      })
      .eq('id', paper.id);

    if (paperUpdateError) {
      throw paperUpdateError;
    }

    if (extraction.confidence < LOW_CONFIDENCE_THRESHOLD) {
      return withJson({ paperId: paper.id, status: 'needs_review' }, 200, request);
    }

    await invokeEdgeFunction('process-paper-enrich', { paperId: paper.id });

    return withJson({ paperId: paper.id, status: 'processing', processingStage: 'enrich' }, 200, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse stage error';

    try {
      if (!paperId) {
        throw new Error('No paper id found.');
      }
      const service = createServiceClient();
      await service
        .from('papers')
        .update({ status: 'failed', processing_error: message })
        .eq('id', paperId);
    } catch {
      // noop
    }

    return withJson({ error: message }, 500, request);
  }
});
