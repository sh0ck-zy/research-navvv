import type {
  LabEdgeDTO,
  LabGraphDTO,
  LabNodeDTO,
  PaperDetailDTO,
  PaperStatus,
  ProcessingStage,
  RecommendationDTO,
  UploadPaperInput,
  UploadPaperResponse,
} from '@research-nav/shared-types';
import { supabase } from '../supabase/client';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface PaperListItem {
  id: string;
  title: string;
  status: PaperStatus;
  processingStage: ProcessingStage;
  processingError: string | null;
  createdAt: string;
}

export interface SaveCorrectionInput {
  paperId: string;
  field: 'title' | 'year' | 'abstract' | 'summary';
  newValue: string;
}

function normalizeGraphNode(row: Record<string, unknown>): LabNodeDTO {
  const aliases = Array.isArray(row.aliases_json)
    ? row.aliases_json.map((alias: unknown) => String(alias)).filter((alias: string) => alias.length > 0)
    : [];

  return {
    id: String(row.id),
    label: aliases[0] ?? String(row.canonical_name),
    type: row.type as LabNodeDTO['type'],
    paperId: row.paper_id ? String(row.paper_id) : undefined,
  };
}

function normalizeGraphEdge(row: Record<string, unknown>): LabEdgeDTO {
  return {
    id: String(row.id),
    source: String(row.source_node_id),
    target: String(row.target_node_id),
    type: row.type as LabEdgeDTO['type'],
    weight: Number(row.weight ?? 1),
  };
}

async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function getAuthedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    throw new Error('You must be logged in.');
  }

  return data.user.id;
}

export async function uploadPaper(file: File): Promise<UploadPaperResponse> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds 25 MB limit.');
  }

  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF uploads are supported in this pilot.');
  }

  const userId = await getAuthedUserId();
  const checksum = await sha256(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${userId}/${Date.now()}-${safeName}`;

  const { error: storageError } = await supabase.storage
    .from('papers')
    .upload(filePath, file, { upsert: false, contentType: file.type });

  if (storageError) {
    throw storageError;
  }

  const payload: UploadPaperInput = {
    filePath,
    fileName: file.name,
    mimeType: file.type,
    checksum,
    sizeBytes: file.size,
  };

  const { data, error } = await supabase.functions.invoke<UploadPaperResponse>('upload-paper', {
    body: payload,
  });

  if (error) {
    throw error;
  }

  if (!data?.paperId) {
    throw new Error('Upload processing did not return a paper id.');
  }

  return data;
}

export async function listPapers(search = ''): Promise<PaperListItem[]> {
  let query = supabase
    .from('papers')
    .select('id, title, status, processing_stage, processing_error, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (search.trim().length > 0) {
    query = query.ilike('title', `%${search.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title ?? 'Untitled paper',
    status: row.status as PaperStatus,
    processingStage: row.processing_stage as ProcessingStage,
    processingError: row.processing_error,
    createdAt: row.created_at,
  }));
}

export async function getLabGraph(): Promise<LabGraphDTO> {
  const [nodesResult, edgesResult] = await Promise.all([
    supabase.from('kg_nodes').select('id, canonical_name, aliases_json, type, paper_id').limit(500),
    supabase.from('kg_edges').select('id, source_node_id, target_node_id, type, weight').limit(1000),
  ]);

  if (nodesResult.error) {
    throw nodesResult.error;
  }

  if (edgesResult.error) {
    throw edgesResult.error;
  }

  return {
    nodes: (nodesResult.data ?? []).map((row) => normalizeGraphNode(row as Record<string, unknown>)),
    edges: (edgesResult.data ?? []).map((row) => normalizeGraphEdge(row as Record<string, unknown>)),
  };
}

export async function getRecommendations(): Promise<RecommendationDTO[]> {
  const { data, error } = await supabase
    .from('recommendations')
    .select('id, paper_id, candidate_paper_id, score, explanation, created_at')
    .order('score', { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  const candidateIds = [...new Set((data ?? []).map((row) => row.candidate_paper_id))];
  let titleById = new Map<string, string>();
  if (candidateIds.length > 0) {
    const { data: candidateRows, error: candidateError } = await supabase
      .from('papers')
      .select('id, title')
      .in('id', candidateIds);

    if (candidateError) {
      throw candidateError;
    }

    titleById = new Map((candidateRows ?? []).map((row) => [row.id, row.title ?? 'Recommended paper']));
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    paperId: row.paper_id,
    candidatePaperId: row.candidate_paper_id,
    title: titleById.get(row.candidate_paper_id) ?? 'Recommended paper',
    score: Number(row.score ?? 0),
    explanation: row.explanation ?? 'Suggested from your graph overlap',
    createdAt: row.created_at,
  }));
}

export async function getPaperDetail(paperId: string): Promise<PaperDetailDTO> {
  const [paperResult, extractionResult, entityResult, relationResult] = await Promise.all([
    supabase
      .from('papers')
      .select('id, title, abstract, summary, year, venue, status, processing_stage, processing_error, created_at, page_count, citations_json')
      .eq('id', paperId)
      .single(),
    supabase
      .from('paper_extractions')
      .select('confidence')
      .eq('paper_id', paperId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('paper_entities')
      .select('id, type, canonical_name, raw_name, confidence, source')
      .eq('paper_id', paperId)
      .order('confidence', { ascending: false }),
    supabase
      .from('paper_relations')
      .select('id, relation_type, source_entity_id, target_entity_id, confidence, source')
      .eq('paper_id', paperId)
      .order('confidence', { ascending: false }),
  ]);

  if (paperResult.error) {
    throw paperResult.error;
  }

  if (entityResult.error) {
    throw entityResult.error;
  }

  if (relationResult.error) {
    throw relationResult.error;
  }

  if (extractionResult.error) {
    throw extractionResult.error;
  }

  return {
    id: paperResult.data.id,
    title: paperResult.data.title ?? 'Untitled paper',
    abstract: paperResult.data.abstract,
    summary: paperResult.data.summary,
    year: paperResult.data.year,
    venue: paperResult.data.venue,
    status: paperResult.data.status as PaperStatus,
    processingStage: paperResult.data.processing_stage as ProcessingStage,
    processingError: paperResult.data.processing_error,
    confidence: extractionResult.data?.confidence ? Number(extractionResult.data.confidence) : null,
    pageCount: paperResult.data.page_count,
    createdAt: paperResult.data.created_at,
    entities: (entityResult.data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      canonicalName: row.canonical_name,
      rawName: row.raw_name,
      confidence: Number(row.confidence),
      source: row.source,
    })),
    relations: (relationResult.data ?? []).map((row) => ({
      id: row.id,
      relationType: row.relation_type,
      sourceEntityId: row.source_entity_id,
      targetEntityId: row.target_entity_id,
      confidence: Number(row.confidence),
      source: row.source,
    })),
    citations: Array.isArray(paperResult.data.citations_json)
      ? paperResult.data.citations_json.map((value: unknown) => String(value))
      : [],
  };
}

export async function savePaperCorrection(input: SaveCorrectionInput): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('You must be logged in.');
  }

  const { data: paper, error: paperError } = await supabase
    .from('papers')
    .select('id, title, abstract, summary, year')
    .eq('id', input.paperId)
    .single();

  if (paperError) {
    throw paperError;
  }

  const currentValue = String((paper as Record<string, unknown>)[input.field] ?? '');

  const { error: correctionError } = await supabase.from('paper_corrections').insert({
    paper_id: input.paperId,
    field: input.field,
    old_value: currentValue,
    new_value: input.newValue,
    corrected_by: user.id,
  });

  if (correctionError) {
    throw correctionError;
  }

  const patch: Record<string, string | number | null> = {};
  patch[input.field] = input.field === 'year' ? Number(input.newValue) || null : input.newValue;

  const { error: updateError } = await supabase
    .from('papers')
    .update(patch)
    .eq('id', input.paperId);

  if (updateError) {
    throw updateError;
  }

  const { error: graphError } = await supabase.functions.invoke('process-paper-graph', {
    body: { paperId: input.paperId, source: 'user_correction' },
  });

  if (graphError) {
    throw graphError;
  }
}

export async function retryPaperProcessing(paperId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('retry-paper-processing', {
    body: { paperId },
  });

  if (error) {
    throw error;
  }
}
