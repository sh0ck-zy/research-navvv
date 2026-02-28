export type PaperStatus = 'uploaded' | 'processing' | 'ready' | 'needs_review' | 'failed';

export type ProcessingStage = 'parse' | 'enrich' | 'graph' | 'done';

export type NodeType = 'paper' | 'author' | 'topic' | 'method' | 'dataset' | 'metric';

export type EdgeType = 'authored_by' | 'mentions' | 'uses' | 'evaluates_on' | 'cites';

export type ExtractionSource = 'claude' | 'openalex' | 'crossref' | 'user';

export interface ExtractionEntity {
  type: NodeType;
  canonicalName: string;
  rawName: string;
  confidence: number;
  source: ExtractionSource;
  externalId?: string;
}

export interface ExtractionRelation {
  relationType: EdgeType;
  sourceEntityKey: string;
  targetEntityKey: string;
  confidence: number;
  source: ExtractionSource;
}

export interface ExtractionResultDTO {
  title: string;
  abstract: string;
  year?: number;
  venue?: string;
  summary: string;
  confidence: number;
  pageCount?: number;
  citations: string[];
  entities: ExtractionEntity[];
  relations: ExtractionRelation[];
}

export interface PaperDetailEntityDTO {
  id: string;
  type: NodeType;
  canonicalName: string;
  rawName: string;
  confidence: number;
  source: ExtractionSource;
}

export interface PaperDetailRelationDTO {
  id: string;
  relationType: EdgeType;
  sourceEntityId: string;
  targetEntityId: string;
  confidence: number;
  source: ExtractionSource;
}

export interface PaperDetailDTO {
  id: string;
  title: string;
  abstract: string | null;
  summary: string | null;
  year: number | null;
  venue: string | null;
  status: PaperStatus;
  processingStage: ProcessingStage;
  processingError: string | null;
  confidence: number | null;
  pageCount: number | null;
  createdAt: string;
  entities: PaperDetailEntityDTO[];
  relations: PaperDetailRelationDTO[];
  citations: string[];
}

export interface LabNodeDTO {
  id: string;
  label: string;
  type: NodeType;
  score?: number;
  paperId?: string;
}

export interface LabEdgeDTO {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
}

export interface LabGraphDTO {
  nodes: LabNodeDTO[];
  edges: LabEdgeDTO[];
}

export interface RecommendationDTO {
  id: string;
  paperId: string;
  candidatePaperId: string;
  title: string;
  score: number;
  explanation: string;
  createdAt: string;
}

export interface UploadPaperInput {
  filePath: string;
  fileName: string;
  mimeType: string;
  checksum: string;
  sizeBytes: number;
}

export interface UploadPaperResponse {
  paperId: string;
  status: PaperStatus;
  processingStage: ProcessingStage;
}

export interface PilotSignupInput {
  email: string;
  password: string;
  name: string;
  researchInterests: string[];
}
