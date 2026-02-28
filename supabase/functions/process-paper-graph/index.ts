import { z } from 'https://esm.sh/zod@3.23.8';
import { config } from '../_shared/config.ts';
import { handleOptions, withJson } from '../_shared/cors.ts';
import { createAuthedClient, createServiceClient } from '../_shared/supabase.ts';
import { canonicalize } from '../_shared/text.ts';

const requestSchema = z.object({
  paperId: z.string().uuid(),
  source: z.string().optional(),
});

type EntityType = 'paper' | 'author' | 'topic' | 'method' | 'dataset' | 'metric';
type RelationType = 'authored_by' | 'mentions' | 'uses' | 'evaluates_on' | 'cites';

interface GraphNode {
  id: string;
  owner_id: string;
  type: EntityType;
  canonical_name: string;
  paper_id: string | null;
}

const relationByEntityType: Record<EntityType, RelationType> = {
  paper: 'mentions',
  author: 'authored_by',
  topic: 'mentions',
  method: 'uses',
  dataset: 'evaluates_on',
  metric: 'mentions',
};

async function getOrCreateNode(
  service: ReturnType<typeof createServiceClient>,
  ownerId: string,
  type: EntityType,
  canonicalName: string,
  aliases: string[] = [],
  paperId: string | null = null
): Promise<GraphNode> {
  await service.from('kg_nodes').upsert(
    {
      owner_id: ownerId,
      type,
      canonical_name: canonicalName,
      aliases_json: aliases,
      paper_id: paperId,
    },
    {
      onConflict: 'owner_id,type,canonical_name',
    }
  );

  const { data, error } = await service
    .from('kg_nodes')
    .select('id, owner_id, type, canonical_name, paper_id')
    .eq('owner_id', ownerId)
    .eq('type', type)
    .eq('canonical_name', canonicalName)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? `Unable to resolve node: ${type}:${canonicalName}`);
  }

  return data as GraphNode;
}

async function upsertEdge(
  service: ReturnType<typeof createServiceClient>,
  ownerId: string,
  relationType: RelationType,
  sourceNodeId: string,
  targetNodeId: string,
  weightIncrement: number,
  provenance: unknown
): Promise<void> {
  const { data: existing, error: existingError } = await service
    .from('kg_edges')
    .select('id, weight, provenance_json')
    .eq('owner_id', ownerId)
    .eq('type', relationType)
    .eq('source_node_id', sourceNodeId)
    .eq('target_node_id', targetNodeId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    const { error: insertError } = await service.from('kg_edges').insert({
      owner_id: ownerId,
      type: relationType,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      weight: weightIncrement,
      provenance_json: [provenance],
    });

    if (insertError) {
      throw insertError;
    }

    return;
  }

  const existingProvenance = Array.isArray(existing.provenance_json) ? existing.provenance_json : [];

  const { error: updateError } = await service
    .from('kg_edges')
    .update({
      weight: Number(existing.weight ?? 0) + weightIncrement,
      provenance_json: [...existingProvenance, provenance],
    })
    .eq('id', existing.id);

  if (updateError) {
    throw updateError;
  }
}

function countOverlap(current: Set<string>, candidate: Set<string>): number {
  let overlap = 0;

  for (const value of current) {
    if (candidate.has(value)) {
      overlap += 1;
    }
  }

  return overlap;
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);

  if (optionsResponse) {
    return optionsResponse;
  }

  const authHeader = request.headers.get('Authorization');
  const isServiceCall = authHeader === `Bearer ${config.supabaseServiceRoleKey}`;
  let callerUserId: string | null = null;

  if (!isServiceCall) {
    if (!authHeader) {
      return withJson({ error: 'Unauthorized pipeline call.' }, 401, request);
    }

    const authedClient = createAuthedClient(authHeader);
    const {
      data: { user },
      error: userError,
    } = await authedClient.auth.getUser();

    if (userError || !user?.id) {
      return withJson({ error: 'Unauthorized pipeline call.' }, 401, request);
    }

    callerUserId = user.id;
  }

  let paperId: string | null = null;

  try {
    const payload = requestSchema.parse(await request.json());
    paperId = payload.paperId;
    const service = createServiceClient();

    let paperQuery = service
      .from('papers')
      .select('id, owner_id, title, doi, status, processing_error, citations_json')
      .eq('id', payload.paperId);

    if (callerUserId) {
      paperQuery = paperQuery.eq('owner_id', callerUserId);
    }

    const { data: paper, error: paperError } = await paperQuery.single();

    if (paperError || !paper) {
      return withJson({ error: 'Paper not found.' }, 404, request);
    }

    const { error: graphStartError } = await service
      .from('papers')
      .update({ status: 'processing', processing_stage: 'graph' })
      .eq('id', paper.id);

    if (graphStartError) {
      throw graphStartError;
    }

    const { data: entities, error: entitiesError } = await service
      .from('paper_entities')
      .select('id, type, canonical_name, raw_name')
      .eq('paper_id', paper.id);

    if (entitiesError) {
      throw entitiesError;
    }

    const { data: relations, error: relationsError } = await service
      .from('paper_relations')
      .select('relation_type, source_entity_id, target_entity_id')
      .eq('paper_id', paper.id);

    if (relationsError) {
      throw relationsError;
    }

    const paperCanonical = `paper:${paper.id}`;
    const paperNode = await getOrCreateNode(
      service,
      paper.owner_id,
      'paper',
      paperCanonical,
      [paper.title || paper.id],
      paper.id
    );

    const entityNodeByPaperEntityId = new Map<string, GraphNode>();

    for (const entity of entities ?? []) {
      const type = entity.type as EntityType;
      const canonicalName = canonicalize(entity.canonical_name || entity.raw_name);

      if (!canonicalName) {
        continue;
      }

      const node = await getOrCreateNode(
        service,
        paper.owner_id,
        type,
        canonicalName,
        [entity.raw_name],
        null
      );

      entityNodeByPaperEntityId.set(entity.id, node);

      const relationType = relationByEntityType[type] ?? 'mentions';
      await upsertEdge(service, paper.owner_id, relationType, paperNode.id, node.id, 1, {
        paperId: paper.id,
        source: payload.source ?? 'pipeline',
      });
    }

    for (const relation of relations ?? []) {
      const sourceNode = entityNodeByPaperEntityId.get(relation.source_entity_id);
      const targetNode = entityNodeByPaperEntityId.get(relation.target_entity_id);

      if (!sourceNode || !targetNode) {
        continue;
      }

      await upsertEdge(
        service,
        paper.owner_id,
        relation.relation_type as RelationType,
        sourceNode.id,
        targetNode.id,
        1,
        {
          paperId: paper.id,
          source: relation.relation_type,
        }
      );
    }

    const citationInputs = Array.isArray(paper.citations_json)
      ? paper.citations_json.map((value: unknown) => canonicalize(String(value)))
      : [];
    const citationSet = new Set(citationInputs.filter((value) => value.length > 0));

    const { data: candidatePapers, error: candidateError } = await service
      .from('papers')
      .select('id, title, doi')
      .eq('owner_id', paper.owner_id)
      .neq('id', paper.id);

    if (candidateError) {
      throw candidateError;
    }

    const citationAdjacency = new Set<string>();

    for (const candidate of candidatePapers ?? []) {
      const candidateDoi = canonicalize(candidate.doi ?? '');
      const candidateTitle = canonicalize(candidate.title ?? '');

      if (
        citationSet.has(candidateDoi) ||
        citationSet.has(candidateTitle) ||
        citationSet.has(candidateDoi.replace('https doi org ', ''))
      ) {
        citationAdjacency.add(candidate.id);

        const targetPaperNode = await getOrCreateNode(
          service,
          paper.owner_id,
          'paper',
          `paper:${candidate.id}`,
          [candidate.title || candidate.id],
          candidate.id
        );

        await upsertEdge(service, paper.owner_id, 'cites', paperNode.id, targetPaperNode.id, 1, {
          paperId: paper.id,
          source: 'citation_match',
        });
      }
    }

    const allPaperIds = [paper.id, ...(candidatePapers ?? []).map((candidate) => candidate.id)];

    const { data: allEntities, error: allEntitiesError } = await service
      .from('paper_entities')
      .select('paper_id, type, canonical_name')
      .in('paper_id', allPaperIds);

    if (allEntitiesError) {
      throw allEntitiesError;
    }

    const perPaperByType = new Map<string, Record<string, Set<string>>>();

    for (const row of allEntities ?? []) {
      const paperKey = String(row.paper_id);
      const typeKey = String(row.type);
      const canonicalName = canonicalize(String(row.canonical_name));

      if (!perPaperByType.has(paperKey)) {
        perPaperByType.set(paperKey, {
          author: new Set<string>(),
          topic: new Set<string>(),
          method: new Set<string>(),
          dataset: new Set<string>(),
          metric: new Set<string>(),
          paper: new Set<string>(),
        });
      }

      perPaperByType.get(paperKey)?.[typeKey]?.add(canonicalName);
    }

    const current = perPaperByType.get(paper.id) ?? {
      author: new Set<string>(),
      topic: new Set<string>(),
      method: new Set<string>(),
      dataset: new Set<string>(),
      metric: new Set<string>(),
      paper: new Set<string>(),
    };

    const recommendationRows: Array<{
      owner_id: string;
      paper_id: string;
      candidate_paper_id: string;
      score: number;
      explanation: string;
    }> = [];

    for (const candidate of candidatePapers ?? []) {
      const candidateEntities = perPaperByType.get(candidate.id) ?? {
        author: new Set<string>(),
        topic: new Set<string>(),
        method: new Set<string>(),
        dataset: new Set<string>(),
        metric: new Set<string>(),
        paper: new Set<string>(),
      };

      const topicOverlap = countOverlap(current.topic, candidateEntities.topic);
      const methodOverlap = countOverlap(current.method, candidateEntities.method);
      const datasetOverlap = countOverlap(current.dataset, candidateEntities.dataset);
      const authorOverlap = countOverlap(current.author, candidateEntities.author);
      const citationBoost = citationAdjacency.has(candidate.id) ? 1 : 0;

      const score =
        topicOverlap * 3 +
        methodOverlap * 2 +
        datasetOverlap * 2 +
        authorOverlap * 1 +
        citationBoost * 1;

      if (score <= 0) {
        continue;
      }

      const reasons: string[] = [];
      if (topicOverlap > 0) reasons.push(`${topicOverlap} shared topic${topicOverlap > 1 ? 's' : ''}`);
      if (methodOverlap > 0) reasons.push(`${methodOverlap} shared method${methodOverlap > 1 ? 's' : ''}`);
      if (datasetOverlap > 0) reasons.push(`${datasetOverlap} shared dataset${datasetOverlap > 1 ? 's' : ''}`);
      if (authorOverlap > 0) reasons.push(`${authorOverlap} shared author${authorOverlap > 1 ? 's' : ''}`);
      if (citationBoost > 0) reasons.push('citation adjacency');

      recommendationRows.push({
        owner_id: paper.owner_id,
        paper_id: paper.id,
        candidate_paper_id: candidate.id,
        score,
        explanation: reasons.slice(0, 3).join(' · '),
      });
    }

    recommendationRows.sort((left, right) => right.score - left.score);

    const { error: deleteRecommendationError } = await service
      .from('recommendations')
      .delete()
      .eq('owner_id', paper.owner_id)
      .eq('paper_id', paper.id);

    if (deleteRecommendationError) {
      throw deleteRecommendationError;
    }

    if (recommendationRows.length > 0) {
      const { error: insertRecommendationError } = await service
        .from('recommendations')
        .insert(recommendationRows.slice(0, 20));

      if (insertRecommendationError) {
        throw insertRecommendationError;
      }
    }

    const currentStatus = String(paper.status);
    const finalStatus = currentStatus === 'needs_review' ? 'needs_review' : 'ready';
    const { error: finalizeError } = await service
      .from('papers')
      .update({
        status: finalStatus,
        processing_stage: 'done',
        processing_error: currentStatus === 'needs_review' ? paper.processing_error : null,
      })
      .eq('id', paper.id);

    if (finalizeError) {
      throw finalizeError;
    }

    return withJson({ paperId: paper.id, status: finalStatus, processingStage: 'done' }, 200, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown graph stage error';

    if (paperId) {
      const service = createServiceClient();
      await service
        .from('papers')
        .update({
          status: 'failed',
          processing_error: message,
          processing_stage: 'graph',
        })
        .eq('id', paperId);
    }

    return withJson({ error: message }, 500, request);
  }
});
