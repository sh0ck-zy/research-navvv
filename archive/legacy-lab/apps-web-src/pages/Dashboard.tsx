import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Compass, Loader2, Search } from 'lucide-react';
import type { LabEdgeDTO, LabNodeDTO } from '@research-nav/shared-types';
import { KnowledgeGraph } from '../components/graph/KnowledgeGraph';
import { FileUpload } from '../components/lab/FileUpload';
import { PaperOverlay } from '../components/lab/PaperOverlay';
import { TopBar } from '../components/lab/TopBar';
import { isSupabaseConfigured } from '../lib/supabase/client';
import { getLabGraph, uploadPaper } from '../lib/api/pilot';

interface GraphMatchItem {
  node: LabNodeDTO;
  score: number;
  reason: string;
}

function seededRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function createDemoGraph(): { nodes: LabNodeDTO[]; edges: LabEdgeDTO[] } {
  const random = seededRandom(2026);
  const nodes: LabNodeDTO[] = [];
  const edges: LabEdgeDTO[] = [];
  let edgeCount = 0;

  const topicTemplates = [
    {
      label: 'Computer Vision',
      paperPrefixes: ['Vision Transformer', 'Open-Vocabulary Detection', 'Video Representation', 'Segmentation Foundation'],
      methods: ['Contrastive Visual Pretraining', 'Diffusion Vision Backbone', 'Sparse Attention Vision'],
      datasets: ['ImageNet-21k', 'COCO', 'ADE20K'],
    },
    {
      label: 'Natural Language Processing',
      paperPrefixes: ['Instruction-Tuned LLMs', 'Long Context Reasoning', 'RAG Evaluation', 'Tool-Augmented LLM'],
      methods: ['Chain-of-Tools', 'GraphRAG', 'Self-Refine Planning'],
      datasets: ['MMLU', 'HotpotQA', 'GSM8K'],
    },
    {
      label: 'Multimodal AI',
      paperPrefixes: ['Vision-Language Alignment', 'Grounded Captioning', 'Multimodal Retrieval', 'Audio-Visual Agents'],
      methods: ['Cross-Modal Contrastive Loss', 'Q-Former Distillation', 'Token Compression'],
      datasets: ['LAION', 'MMBench', 'MSR-VTT'],
    },
    {
      label: 'Bioinformatics',
      paperPrefixes: ['Protein Language Models', 'Gene Expression Forecasting', 'Clinical LLM Evaluation', 'Drug Discovery Agents'],
      methods: ['Molecular Graph Attention', 'Sequence Diffusion', 'Constraint-Guided Decoding'],
      datasets: ['UniProt', 'PubMedQA', 'MIMIC-IV'],
    },
    {
      label: 'Robotics',
      paperPrefixes: ['Embodied Agent Planning', 'Vision-Language Policies', 'Dexterous Manipulation', 'Robot Skill Transfer'],
      methods: ['Trajectory Replay', 'World Model RL', 'Latent Skill Graphs'],
      datasets: ['RoboNet', 'BridgeData', 'RT-X'],
    },
    {
      label: 'Reinforcement Learning',
      paperPrefixes: ['Policy Optimization at Scale', 'Offline RL Benchmarks', 'Model-Based RL Systems', 'Hierarchical RL Agents'],
      methods: ['Preference Optimization', 'World Models', 'Trajectory Stitching'],
      datasets: ['D4RL', 'Atari-57', 'MineDojo'],
    },
    {
      label: 'Graph Machine Learning',
      paperPrefixes: ['Graph Transformers', 'Relational Message Passing', 'Heterogeneous Graph Retrieval', 'Temporal Graph Forecasting'],
      methods: ['Graph Contrastive Pretraining', 'Subgraph Prompting', 'Graph Memory Networks'],
      datasets: ['OGB', 'MAG240M', 'WikiKG90M'],
    },
  ];

  const globalMetrics = ['F1', 'NDCG@10', 'Latency', 'Faithfulness', 'Robustness'];
  const authorPool = Array.from({ length: 140 }, (_, index) => `Researcher ${index + 1}`);
  const papersPerTopic = 140;

  const metricIds = globalMetrics.map((label, index) => {
    const id = `metric-${index + 1}`;
    nodes.push({ id, label, type: 'metric' });
    return id;
  });

  const authorIds = authorPool.map((label, index) => {
    const id = `author-${index + 1}`;
    nodes.push({ id, label, type: 'author' });
    return id;
  });

  const addEdge = (source: string, target: string, type: LabEdgeDTO['type'], weight = 1) => {
    edgeCount += 1;
    edges.push({
      id: `edge-${edgeCount}`,
      source,
      target,
      type,
      weight,
    });
  };

  const allPaperIds: string[] = [];
  const topicIds: string[] = [];

  topicTemplates.forEach((topic, topicIndex) => {
    const topicId = `topic-${topicIndex + 1}`;
    topicIds.push(topicId);
    nodes.push({ id: topicId, label: topic.label, type: 'topic' });

    const methodIds = topic.methods.map((methodLabel, methodIndex) => {
      const id = `method-${topicIndex + 1}-${methodIndex + 1}`;
      nodes.push({ id, label: methodLabel, type: 'method' });
      return id;
    });

    const datasetIds = topic.datasets.map((datasetLabel, datasetIndex) => {
      const id = `dataset-${topicIndex + 1}-${datasetIndex + 1}`;
      nodes.push({ id, label: datasetLabel, type: 'dataset' });
      return id;
    });

    for (let i = 0; i < papersPerTopic; i += 1) {
      const titlePrefix = topic.paperPrefixes[i % topic.paperPrefixes.length];
      const titleSuffix = ['Benchmarks', 'in the Wild', 'with Agents', 'for Real-Time Systems', 'at Scale'][i % 5];
      const title = `${titlePrefix} for ${topic.label}: ${titleSuffix}`;
      const paperId = `paper-${topicIndex + 1}-${i + 1}`;

      nodes.push({ id: paperId, label: title, type: 'paper', paperId });
      allPaperIds.push(paperId);

      const method = methodIds[Math.floor(random() * methodIds.length)];
      const dataset = datasetIds[Math.floor(random() * datasetIds.length)];
      const metric = metricIds[Math.floor(random() * metricIds.length)];
      const authorA = authorIds[Math.floor(random() * authorIds.length)];
      const authorB = authorIds[Math.floor(random() * authorIds.length)];

      addEdge(paperId, topicId, 'mentions', 2);
      addEdge(paperId, method, 'uses', 1 + Math.floor(random() * 2));
      addEdge(paperId, dataset, 'evaluates_on', 1 + Math.floor(random() * 2));
      addEdge(paperId, metric, 'mentions', 1);
      addEdge(authorA, paperId, 'authored_by', 1);
      if (authorB !== authorA) {
        addEdge(authorB, paperId, 'authored_by', 1);
      }

      if (i > 0) {
        const previousPaper = `paper-${topicIndex + 1}-${Math.max(1, i - 1)}`;
        addEdge(paperId, previousPaper, 'cites', 1);
      }

      if (i > 2 && random() > 0.42) {
        const localReference = `paper-${topicIndex + 1}-${Math.max(1, i - 2 - Math.floor(random() * 4))}`;
        if (localReference !== paperId) {
          addEdge(paperId, localReference, 'cites', 1);
        }
      }
    }
  });

  for (let i = 0; i < topicIds.length; i += 1) {
    const source = topicIds[i];
    const target = topicIds[(i + 1) % topicIds.length];
    addEdge(source, target, 'mentions', 1);
  }

  for (let i = 0; i < allPaperIds.length; i += 1) {
    if (random() > 0.87) {
      const source = allPaperIds[i];
      const target = allPaperIds[Math.floor(random() * allPaperIds.length)];
      if (source !== target) {
        addEdge(source, target, 'cites', 1);
      }
    }
  }

  return { nodes, edges };
}

const DEMO_GRAPH = createDemoGraph();

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function buildAdjacency(edges: LabEdgeDTO[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  const addNeighbor = (source: string, target: string) => {
    const existing = adjacency.get(source);
    if (existing) {
      existing.add(target);
    } else {
      adjacency.set(source, new Set([target]));
    }
  };

  for (const edge of edges) {
    addNeighbor(edge.source, edge.target);
    addNeighbor(edge.target, edge.source);
  }

  return adjacency;
}

function scoreTextMatch(query: string, label: string): number {
  const q = normalizeText(query);
  const candidate = normalizeText(label);
  if (!q || !candidate) {
    return 0;
  }

  if (candidate === q) {
    return 1;
  }

  if (candidate.startsWith(q)) {
    return 0.92;
  }

  if (candidate.includes(q)) {
    return 0.78;
  }

  const qTokens = tokenize(q);
  const labelTokens = new Set(tokenize(candidate));
  if (qTokens.length === 0) {
    return 0;
  }

  const overlap = qTokens.filter((token) => {
    if (labelTokens.has(token)) {
      return true;
    }

    for (const labelToken of labelTokens) {
      if (labelToken.includes(token) || token.includes(labelToken)) {
        return true;
      }
    }

    return false;
  }).length;

  if (overlap === 0) {
    return 0;
  }

  return Math.min(0.72, overlap / qTokens.length);
}

function computeClusterFromQuery(query: string, nodes: LabNodeDTO[], edges: LabEdgeDTO[]) {
  const q = query.trim();
  if (!q) {
    return {
      anchor: null,
      focusNodeIds: [] as string[],
      matches: [] as GraphMatchItem[],
      message: 'Type a paper, author, or subfield and press Enter to navigate the galaxy.',
    };
  }

  const adjacency = buildAdjacency(edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const typeBoost: Record<LabNodeDTO['type'], number> = {
    topic: 0.16,
    paper: 0.13,
    author: 0.08,
    method: 0.07,
    dataset: 0.05,
    metric: 0.03,
  };

  const rankedTextCandidates = nodes
    .map((node) => {
      const textScore = scoreTextMatch(q, node.label);
      const score = textScore + (textScore > 0 ? typeBoost[node.type] : 0);
      return { node, textScore, score };
    })
    .filter((candidate) => candidate.textScore > 0)
    .sort((a, b) => b.score - a.score);

  if (rankedTextCandidates.length === 0) {
    return {
      anchor: null,
      focusNodeIds: [] as string[],
      matches: [] as GraphMatchItem[],
      message: `No cluster found for "${q}" in the current graph.`,
    };
  }

  const seedIds = rankedTextCandidates.slice(0, 4).map((candidate) => candidate.node.id);
  const visitedDepth = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [];

  for (const seedId of seedIds) {
    visitedDepth.set(seedId, 0);
    queue.push({ id: seedId, depth: 0 });
  }

  while (queue.length > 0 && visitedDepth.size < 340) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (current.depth >= 2) {
      continue;
    }

    const neighbors = adjacency.get(current.id);
    if (!neighbors) {
      continue;
    }

    for (const neighborId of neighbors) {
      const nextDepth = current.depth + 1;
      if (!visitedDepth.has(neighborId) || (visitedDepth.get(neighborId) ?? 99) > nextDepth) {
        visitedDepth.set(neighborId, nextDepth);
        queue.push({ id: neighborId, depth: nextDepth });
      }
    }
  }

  const focusNodeIds = Array.from(visitedDepth.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id)
    .slice(0, 260);

  const papersInCluster = focusNodeIds
    .map((id) => nodeById.get(id))
    .filter((node): node is LabNodeDTO => node !== undefined && node.type === 'paper');

  const paperMatches = papersInCluster
    .map((paper) => {
      const textScore = scoreTextMatch(q, paper.label);
      const depth = visitedDepth.get(paper.id) ?? 2;
      const degree = adjacency.get(paper.id)?.size ?? 0;
      const depthBoost = depth === 0 ? 24 : depth === 1 ? 16 : 10;
      const score = textScore * 72 + depthBoost + Math.min(12, degree * 0.85);

      const reason =
        depth === 0
          ? 'Direct semantic match with your query'
          : depth === 1
            ? 'One hop from your seed cluster'
            : 'Connected paper in the same local community';

      return {
        node: paper,
        score,
        reason,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const fallbackPapers = rankedTextCandidates
    .map((candidate) => candidate.node)
    .filter((node) => node.type === 'paper')
    .slice(0, 8)
    .map((node, index) => ({
      node,
      score: 82 - index * 6,
      reason: 'Best textual match in current graph',
    }));

  const matches = paperMatches.length > 0 ? paperMatches : fallbackPapers;
  const anchor = rankedTextCandidates[0]?.node ?? null;

  return {
    anchor,
    focusNodeIds,
    matches,
    message: `Navigating ${anchor.label} cluster · ${focusNodeIds.length} connected nodes`,
  };
}

function buildDefaultMatches(nodes: LabNodeDTO[]): GraphMatchItem[] {
  return nodes
    .filter((node) => node.type === 'paper')
    .slice(0, 8)
    .map((node, index) => ({
      node,
      score: 90 - index * 5,
      reason: 'Trending paper in this local galaxy sample',
    }));
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusNodeIds, setFocusNodeIds] = useState<string[]>([]);
  const [focusMessage, setFocusMessage] = useState('Type a paper, author, or subfield and press Enter to navigate the galaxy.');
  const [searchMatches, setSearchMatches] = useState<GraphMatchItem[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<{ paperId: string; title: string } | null>(null);

  const graphQuery = useQuery({
    queryKey: ['graph'],
    queryFn: getLabGraph,
    refetchInterval: 10000,
    enabled: isSupabaseConfigured,
  });

  const graphData = isSupabaseConfigured
    ? { nodes: graphQuery.data?.nodes ?? [], edges: graphQuery.data?.edges ?? [] }
    : DEMO_GRAPH;

  const defaultMatches = useMemo(() => buildDefaultMatches(graphData.nodes), [graphData.nodes]);

  const focusedNode = useMemo(
    () => graphData.nodes.find((node) => node.id === focusNodeId) ?? null,
    [focusNodeId, graphData.nodes]
  );

  const uploadMutation = useMutation({
    mutationFn: uploadPaper,
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['graph'] })]);
    },
  });

  const hasCriticalError = Boolean(isSupabaseConfigured && graphQuery.error);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = searchInput.trim();

    if (!term) {
      setFocusNodeId(null);
      setFocusNodeIds([]);
      setSearchMatches([]);
      setFocusMessage('Type a paper, author, or subfield and press Enter to navigate the galaxy.');
      return;
    }

    const result = computeClusterFromQuery(term, graphData.nodes, graphData.edges);

    if (!result.anchor) {
      setFocusNodeId(null);
      setFocusNodeIds([]);
      setSearchMatches([]);
      setFocusMessage(result.message);
      return;
    }

    setFocusNodeId(result.anchor.id);
    setFocusNodeIds(result.focusNodeIds);
    setSearchMatches(result.matches);
    setFocusMessage(result.message);
  };

  const displayedMatches = searchMatches.length > 0 ? searchMatches : defaultMatches;

  return (
    <div className="min-h-screen text-slate-100">
      <TopBar />
      <main className="relative h-[calc(100vh-4rem)] overflow-hidden">
        <KnowledgeGraph
          className="h-full w-full"
          nodes={graphData.nodes}
          edges={graphData.edges}
          focusNodeId={focusNodeId}
          focusNodeIds={focusNodeIds}
          onNodeClick={(node) => {
            setFocusNodeId(node.id);
            setFocusNodeIds([node.id]);
            setFocusMessage(`Focused on ${node.label}`);
            if (node.type === 'paper' && node.paperId) {
              setSelectedPaper({
                paperId: node.paperId,
                title: node.label,
              });
            }
          }}
        />

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(9,7,24,0)_0%,rgba(5,8,26,0.56)_68%,rgba(2,4,12,0.9)_100%)]" />

        {hasCriticalError ? (
          <div className="absolute left-1/2 top-4 z-30 w-[min(760px,92vw)] -translate-x-1/2 rounded-2xl border border-red-300/45 bg-red-500/15 px-4 py-3 text-sm text-red-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <p>Failed to load live graph data. Check Supabase config and database setup.</p>
            </div>
          </div>
        ) : null}

        <section className="absolute left-1/2 top-[45%] z-20 w-[min(920px,92vw)] -translate-x-1/2 -translate-y-1/2">
          <h1 className="mb-4 text-center text-3xl font-semibold text-slate-50 sm:text-5xl">Navigate the Research Galaxy</h1>
          <form
            onSubmit={handleSearchSubmit}
            className="rounded-[2rem] border border-cyan-200/25 bg-slate-900/72 p-2 shadow-[0_30px_60px_rgba(2,8,20,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-2">
              <Search className="ml-2 h-5 w-5 text-cyan-100/75" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Try: computer vision · Geoffrey Hinton · vision transformer"
                className="h-12 w-full bg-transparent px-1 text-sm text-slate-100 outline-none placeholder:text-slate-400 sm:text-base"
              />
              <button
                type="submit"
                className="inline-flex h-11 min-w-[84px] items-center justify-center rounded-2xl border border-cyan-200/35 bg-cyan-300/12 px-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/20"
              >
                {graphQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Navigate'}
              </button>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-300/85 sm:text-sm">
            <p>{focusMessage}</p>
            <p className="inline-flex items-center gap-1 rounded-full border border-cyan-200/20 bg-slate-900/55 px-3 py-1">
              <Compass className="h-3.5 w-3.5 text-cyan-200" />
              {focusedNode ? focusedNode.type : 'live graph'}
            </p>
          </div>
        </section>

        <aside className="absolute bottom-5 left-5 z-20 w-[min(360px,90vw)] rounded-3xl border border-cyan-200/20 bg-slate-950/72 p-4 shadow-[0_20px_45px_rgba(2,8,20,0.5)] backdrop-blur-xl">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100/85">Ingest</h2>
          <FileUpload
            onUpload={async (file) => {
              await uploadMutation.mutateAsync(file);
            }}
            isUploading={uploadMutation.isPending}
            disabled={!isSupabaseConfigured}
          />
          {uploadMutation.error ? (
            <p className="mt-2 text-xs text-red-200/90">
              {uploadMutation.error instanceof Error ? uploadMutation.error.message : 'Upload failed.'}
            </p>
          ) : null}
        </aside>

        <aside className="absolute bottom-5 right-5 z-20 w-[min(390px,92vw)] rounded-3xl border border-cyan-200/20 bg-slate-950/72 p-4 shadow-[0_20px_45px_rgba(2,8,20,0.5)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100/85">Best Matches</h2>
            <span className="rounded-full border border-cyan-200/20 bg-slate-900/65 px-2.5 py-1 text-[10px] font-semibold text-cyan-100">
              {displayedMatches.length} papers
            </span>
          </div>
          <div className="space-y-2">
            {displayedMatches.slice(0, 8).map((item, index) => (
              <button
                key={item.node.id}
                onClick={() => {
                  setFocusNodeId(item.node.id);
                  setFocusNodeIds([item.node.id]);
                  setFocusMessage(`Focused on ${item.node.label}`);
                  if (item.node.paperId) {
                    setSelectedPaper({
                      paperId: item.node.paperId,
                      title: item.node.label,
                    });
                  }
                }}
                className="w-full rounded-2xl border border-cyan-200/15 bg-slate-900/55 p-3 text-left transition hover:border-cyan-200/35 hover:bg-slate-900/85"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-100">{item.node.label}</p>
                  <span className="rounded-full border border-cyan-200/25 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                    {Math.max(1, Math.round(item.score - index * 0.5))}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-300/85">{item.reason}</p>
              </button>
            ))}
          </div>
        </aside>

        <PaperOverlay
          paper={selectedPaper}
          onClose={() => {
            setSelectedPaper(null);
          }}
        />
      </main>
    </div>
  );
}
