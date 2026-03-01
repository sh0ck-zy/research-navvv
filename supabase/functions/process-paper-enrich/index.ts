import { z } from 'https://esm.sh/zod@3.23.8';
import { config } from '../_shared/config.ts';
import { handleOptions, withJson } from '../_shared/cors.ts';
import { invokeEdgeFunction } from '../_shared/pipeline.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { canonicalize } from '../_shared/text.ts';

const requestSchema = z.object({
  paperId: z.string().uuid(),
});

function normalizeCitation(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

async function enrichWithOpenAlex(title: string) {
  const response = await fetch(
    `https://api.openalex.org/works?search=${encodeURIComponent(title)}&per-page=1`
  );

  if (!response.ok) {
    throw new Error(`OpenAlex failed: ${await response.text()}`);
  }

  const payload = await response.json();
  const first = payload?.results?.[0];

  if (!first) {
    return null;
  }

  const citations: string[] = (first.referenced_works ?? []).map((value: string) => String(value));
  const authors: string[] = (first.authorships ?? [])
    .map((item: any) => item?.author?.display_name)
    .filter((value: unknown) => typeof value === 'string' && value.length > 0);

  return {
    doi: first.doi ? String(first.doi).replace('https://doi.org/', '') : null,
    year: typeof first.publication_year === 'number' ? first.publication_year : null,
    venue: first.primary_location?.source?.display_name ?? null,
    citations,
    authors,
  };
}

async function enrichWithCrossref(title: string) {
  const response = await fetch(
    `https://api.crossref.org/works?query.title=${encodeURIComponent(title)}&rows=1`
  );

  if (!response.ok) {
    throw new Error(`Crossref failed: ${await response.text()}`);
  }

  const payload = await response.json();
  const first = payload?.message?.items?.[0];

  if (!first) {
    return null;
  }

  const citations: string[] = (first.reference ?? [])
    .map((item: any) => item.DOI || item['article-title'] || item.unstructured)
    .filter((value: unknown) => typeof value === 'string' && value.length > 0)
    .map((value: string) => String(value));

  const authors: string[] = (first.author ?? [])
    .map((author: any) => [author.given, author.family].filter(Boolean).join(' ').trim())
    .filter((value: string) => value.length > 0);

  const year = first?.issued?.['date-parts']?.[0]?.[0];
  const venue = Array.isArray(first['container-title']) ? first['container-title'][0] : null;

  return {
    doi: first.DOI ?? null,
    year: typeof year === 'number' ? year : null,
    venue: typeof venue === 'string' ? venue : null,
    citations,
    authors,
  };
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
      .select('id, title, owner_id, year, venue, doi, citations_json')
      .eq('id', payload.paperId)
      .single();

    if (paperError || !paper) {
      return withJson({ error: 'Paper not found.' }, 404, request);
    }

    const { error: stageError } = await service
      .from('papers')
      .update({ status: 'processing', processing_stage: 'enrich', processing_error: null })
      .eq('id', paper.id);

    if (stageError) {
      throw stageError;
    }

    const title = paper.title ?? '';

    let enrichment = null;
    let enrichmentSource: 'openalex' | 'crossref' | null = null;

    if (title) {
      try {
        enrichment = await enrichWithOpenAlex(title);
        if (enrichment) {
          enrichmentSource = 'openalex';
        }
      } catch {
        // fallback handled below
      }

      if (!enrichment) {
        try {
          enrichment = await enrichWithCrossref(title);
          if (enrichment) {
            enrichmentSource = 'crossref';
          }
        } catch {
          enrichment = null;
          enrichmentSource = null;
        }
      }
    }

    if (enrichment) {
      const existingCitations = Array.isArray(paper.citations_json)
        ? paper.citations_json.map((citation: unknown) => String(citation))
        : [];
      const mergedCitations = [...new Set([...existingCitations, ...enrichment.citations.map(normalizeCitation)])]
        .filter((citation) => citation.length > 0)
        .slice(0, 200);

      const { error: paperUpdateError } = await service
        .from('papers')
        .update({
          doi: paper.doi ?? enrichment.doi,
          year: paper.year ?? enrichment.year,
          venue: paper.venue ?? enrichment.venue,
          citations_json: mergedCitations,
        })
        .eq('id', paper.id);

      if (paperUpdateError) {
        throw paperUpdateError;
      }

      if (enrichment.authors.length > 0) {
        const authorRows = enrichment.authors
          .map((author) => ({
            paper_id: paper.id,
            type: 'author',
            canonical_name: canonicalize(author),
            raw_name: author,
            confidence: 0.85,
            source: enrichmentSource ?? 'crossref',
          }))
          .filter((row) => row.canonical_name.length > 0);

        if (authorRows.length > 0) {
          const { error: authorUpsertError } = await service.from('paper_entities').upsert(authorRows, {
            onConflict: 'paper_id,type,canonical_name,source',
            ignoreDuplicates: true,
          });

          if (authorUpsertError) {
            throw authorUpsertError;
          }
        }
      }
    }

    const { error: graphStageError } = await service
      .from('papers')
      .update({
        status: 'processing',
        processing_stage: 'graph',
      })
      .eq('id', paper.id);

    if (graphStageError) {
      throw graphStageError;
    }

    await invokeEdgeFunction('process-paper-graph', { paperId: paper.id, source: enrichmentSource ?? 'crossref' });

    return withJson({ paperId: paper.id, status: 'processing', processingStage: 'graph' }, 200, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown enrich stage error';

    if (paperId) {
      const service = createServiceClient();
      await service
        .from('papers')
        .update({ status: 'failed', processing_error: message })
        .eq('id', paperId);
    }

    return withJson({ error: message }, 500, request);
  }
});
