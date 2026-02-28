import { GalaxyNodesFileSchema, type GalaxyNode } from './schema';

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

  const parsed = GalaxyNodesFileSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      status: 'error',
      message: `Invalid nodes.json at "${formatIssuePath(first.path)}": ${first.message}`,
    };
  }

  if (parsed.data.length === 0) {
    return { status: 'empty', nodes: [] };
  }

  return { status: 'success', nodes: parsed.data };
}
