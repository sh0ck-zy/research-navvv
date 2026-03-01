import { z } from 'https://esm.sh/zod@3.23.8';
import { handleOptions, withJson } from '../_shared/cors.ts';
import { invokeEdgeFunction } from '../_shared/pipeline.ts';
import { createAuthedClient, createServiceClient } from '../_shared/supabase.ts';

const requestSchema = z.object({
  paperId: z.string().uuid(),
});

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);

  if (optionsResponse) {
    return optionsResponse;
  }

  try {
    const payload = requestSchema.parse(await request.json());
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return withJson({ error: 'Missing Authorization header.' }, 401, request);
    }

    const authedClient = createAuthedClient(authHeader);
    const service = createServiceClient();

    const {
      data: { user },
      error: userError,
    } = await authedClient.auth.getUser();

    if (userError || !user) {
      return withJson({ error: 'Unauthorized.' }, 401, request);
    }

    const { data: paper, error: paperError } = await service
      .from('papers')
      .select('id, owner_id, processing_attempts')
      .eq('id', payload.paperId)
      .single();

    if (paperError || !paper) {
      return withJson({ error: 'Paper not found.' }, 404, request);
    }

    if (paper.owner_id !== user.id) {
      return withJson({ error: 'Forbidden.' }, 403, request);
    }

    if (Number(paper.processing_attempts ?? 0) >= 2) {
      return withJson({ error: 'Retry limit reached for this paper.' }, 400, request);
    }

    const { error: resetError } = await service
      .from('papers')
      .update({
        status: 'processing',
        processing_stage: 'parse',
        processing_error: null,
      })
      .eq('id', paper.id);

    if (resetError) {
      throw resetError;
    }

    await invokeEdgeFunction('process-paper-parse', {
      paperId: paper.id,
      source: 'retry',
    });

    return withJson({ paperId: paper.id, status: 'processing', processingStage: 'parse' }, 200, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown retry error';
    return withJson({ error: message }, 500, request);
  }
});
