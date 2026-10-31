import { GalaxyNodesFileSchema, RawGalaxyNodesFileSchema, type GalaxyNode, type RawGalaxyNode } from './schema';

export type GalaxyLoadResult =
  | { status: 'success'; nodes: GalaxyNode[] }
  | { status: 'empty'; nodes: GalaxyNode[] }
  | { status: 'error'; message: string };

function formatIssuePath(path: Array<string | number>) {
  if (path.length === 0) {
    return 'root';
  }

  return path
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : segment))
    .join('.');
}

function normalizeAuthors(value: RawGalaxyNode['authors']): string[] | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const compact = value.map((author) => author.trim()).filter((author) => author.length > 0);
    return compact.length > 0 ? compact : undefined;
  }

  const split = value
    .split(/,| and /gi)
    .map((author) => author.trim())
    .filter((author) => author.length > 0);

  return split.length > 0 ? split : [value.trim()];
}

function normalizeNode(raw: RawGalaxyNode): GalaxyNode {
  return {
    id: raw.id,
    title: raw.title,
    year: raw.year,
    category: raw.category ?? raw.primaryCategory,
    authors: normalizeAuthors(raw.authors),
    abstract: raw.abstract ?? raw.summary,
    cluster: raw.cluster,
    clusterLabel: raw.clusterLabel,
    x: raw.x,
    y: raw.y,
    z: raw.z,
    size: raw.size,
    sizeBase: raw.sizeBase,
    alphaBase: raw.alphaBase,
    layer: raw.layer,
    isBridge: raw.isBridge,
    url: raw.url,
  };
}

function isCanonicalPaperNode(node: GalaxyNode): boolean {
  return node.id.trim().length > 0 && node.title.trim().length > 0;
}

export async function loadGalaxyNodes(signal?: AbortSignal): Promise<GalaxyLoadResult> {
  let response: Response;

  try {
    response = await fetch('/demo/nodes.json', { signal });
  } catch {
    return { status: 'error', message: 'Failed to fetch /demo/nodes.json. Check your dev server.' };
  }

  if (!response.ok) {
    return {
      status: 'error',
      message: `Could not load /demo/nodes.json (HTTP ${response.status}).`,
    };
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return { status: 'error', message: 'nodes.json is not valid JSON.' };
  }

  const parsedRaw = RawGalaxyNodesFileSchema.safeParse(payload);
  if (!parsedRaw.success) {
    const first = parsedRaw.error.issues[0];
    return {
      status: 'error',
      message: `Invalid nodes.json at "${formatIssuePath(first.path)}": ${first.message}`,
    };
  }

  const normalized = parsedRaw.data
    .filter((raw) => raw.isAmbient !== true)
    .map(normalizeNode)
    .filter(isCanonicalPaperNode);
  const parsedCanonical = GalaxyNodesFileSchema.safeParse(normalized);
  if (!parsedCanonical.success) {
    const first = parsedCanonical.error.issues[0];
    return {
      status: 'error',
      message: `Invalid normalized nodes at "${formatIssuePath(first.path)}": ${first.message}`,
    };
  }

  if (parsedCanonical.data.length === 0) {
    return { status: 'empty', nodes: [] };
  }

  return { status: 'success', nodes: parsedCanonical.data };
}
