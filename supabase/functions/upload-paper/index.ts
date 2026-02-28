import { z } from 'https://esm.sh/zod@3.23.8';
import { handleOptions, withJson } from '../_shared/cors.ts';
import { config } from '../_shared/config.ts';
import { invokeEdgeFunction, monthStartIso } from '../_shared/pipeline.ts';
import { createAuthedClient, createServiceClient } from '../_shared/supabase.ts';

const uploadSchema = z.object({
  filePath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.literal('application/pdf'),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i, 'checksum must be a SHA-256 hash'),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
});

const STORAGE_OBJECT_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function validateStoragePath(filePath: string, userId: string): { ownerPrefix: string; objectName: string } {
  const parts = filePath.split('/');
  if (parts.length !== 2) {
    throw new Error('Invalid storage path format.');
  }

  const [ownerPrefix, objectName] = parts;

  if (ownerPrefix !== userId) {
    throw new Error('Storage path does not match authenticated user.');
  }

  if (!STORAGE_OBJECT_NAME_REGEX.test(objectName) || objectName.includes('..')) {
    throw new Error('Invalid storage object name.');
  }

  return { ownerPrefix, objectName };
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);

  if (optionsResponse) {
    return optionsResponse;
  }

  try {
    const payload = uploadSchema.parse(await request.json());
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

    const { ownerPrefix, objectName } = validateStoragePath(payload.filePath, user.id);

    const { data: uploadedObjects, error: storageLookupError } = await service.storage.from('papers').list(ownerPrefix, {
      search: objectName,
      limit: 1,
    });

    if (storageLookupError) {
      return withJson({ error: storageLookupError.message }, 500, request);
    }

    const uploadedObject = (uploadedObjects ?? []).find((entry) => entry.name === objectName);
    if (!uploadedObject) {
      return withJson({ error: 'Uploaded file not found in storage.' }, 400, request);
    }

    const objectSize = Number(uploadedObject.metadata?.size ?? uploadedObject.metadata?.contentLength ?? 0);
    if (objectSize > 0 && objectSize !== payload.sizeBytes) {
      return withJson({ error: 'Uploaded file metadata does not match request payload.' }, 400, request);
    }

    const { data: usageRows, error: usageError } = await service
      .from('ai_usage_daily')
      .select('estimated_cost_usd')
      .eq('owner_id', user.id)
      .gte('day', monthStartIso().slice(0, 10));

    if (usageError) {
      return withJson({ error: usageError.message }, 500, request);
    }

    const monthlySpend = (usageRows ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);

    if (monthlySpend >= config.aiMonthlyCapUsd) {
      return withJson(
        {
          error: `AI processing is paused for this month after reaching the $${config.aiMonthlyCapUsd} cap.`,
        },
        402,
        request
      );
    }

    const { data: paper, error: insertError } = await service
      .from('papers')
      .insert({
        owner_id: user.id,
        status: 'processing',
        processing_stage: 'parse',
        processing_attempts: 0,
        checksum: payload.checksum,
        storage_path: payload.filePath,
        file_name: payload.fileName,
        mime_type: payload.mimeType,
        size_bytes: payload.sizeBytes,
      })
      .select('id, status, processing_stage')
      .single();

    if (insertError || !paper) {
      return withJson({ error: insertError?.message ?? 'Failed to create paper record.' }, 500, request);
    }

    try {
      await invokeEdgeFunction('process-paper-parse', { paperId: paper.id });
    } catch (invokeError) {
      await service
        .from('papers')
        .update({
          status: 'failed',
          processing_error: invokeError instanceof Error ? invokeError.message : 'Failed to start parse stage.',
        })
        .eq('id', paper.id);

      throw invokeError;
    }

    return withJson(
      {
        paperId: paper.id,
        status: paper.status,
        processingStage: paper.processing_stage,
      },
      200,
      request
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return withJson({ error: message }, 500, request);
  }
});
