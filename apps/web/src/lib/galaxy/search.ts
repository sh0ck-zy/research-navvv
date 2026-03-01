import Fuse from 'fuse.js';
import type { GalaxyNode } from './schema';

export interface GalaxySearchResult {
  node: GalaxyNode;
  label: string;
}

interface SearchDocument {
  id: string;
  title: string;
  category: string;
  authorsText: string;
  abstract: string;
  yearText: string;
  titleLower: string;
  categoryLower: string;
  authorsLower: string;
  searchBlobLower: string;
  node: GalaxyNode;
}

export interface GalaxySearchIndex {
  nodes: GalaxyNode[];
  documents: SearchDocument[];
  fuse: Fuse<SearchDocument>;
}

function authorsText(node: GalaxyNode) {
  return node.authors?.join(', ') ?? '';
}

function displayLabel(node: GalaxyNode) {
  const authors = node.authors?.join(', ') ?? 'Unknown';
  const year = node.year ?? 'n/a';
  return `${node.title} · ${authors} · ${year}`;
}

export function createGalaxySearchIndex(nodes: GalaxyNode[]): GalaxySearchIndex {
  const documents = nodes.map((node) => ({
    id: node.id,
    title: node.title,
    category: node.category ?? node.clusterLabel ?? '',
    authorsText: authorsText(node),
    abstract: (node.abstract ?? '').slice(0, 240),
    yearText: node.year ? String(node.year) : '',
    titleLower: node.title.toLowerCase(),
    categoryLower: (node.category ?? node.clusterLabel ?? '').toLowerCase(),
    authorsLower: authorsText(node).toLowerCase(),
    searchBlobLower: `${node.title} ${authorsText(node)} ${node.category ?? ''} ${node.abstract ?? ''}`.toLowerCase(),
    node,
  }));

  const fuseKeys: Array<keyof SearchDocument> = ['title', 'authorsText', 'category', 'abstract'];
  const fuseIndex = Fuse.createIndex(fuseKeys, documents);
  const fuse = new Fuse(documents, {
    includeScore: true,
    threshold: 0.32,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'authorsText', weight: 0.2 },
      { name: 'category', weight: 0.2 },
      { name: 'abstract', weight: 0.1 },
    ],
  }, fuseIndex);

  return { nodes, documents, fuse };
}

export function searchGalaxyNodes(index: GalaxySearchIndex, query: string, limit = 6): GalaxySearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const queryLower = trimmed.toLowerCase();
  const tokens = queryLower.split(/\s+/).filter((token) => token.length > 0);

  const rankedContains = index.documents
    .map((doc) => {
      const titleMatch = doc.titleLower.includes(queryLower);
      const categoryMatch = doc.categoryLower.includes(queryLower);
      const authorsMatch = doc.authorsLower.includes(queryLower);
      const yearMatch = doc.yearText.includes(trimmed);
      const tokenCoverage = tokens.every((token) => doc.searchBlobLower.includes(token));
      if (!tokenCoverage) {
        return null;
      }

      let score = 0;
      if (titleMatch) {
        score += doc.titleLower.startsWith(queryLower) ? 8 : 5;
      }
      if (authorsMatch) {
        score += 2;
      }
      if (categoryMatch) {
        score += 2;
      }
      if (yearMatch) {
        score += 1;
      }

      return { doc, score };
    })
    .filter((item): item is { doc: SearchDocument; score: number } => item !== null)
    .sort((left, right) => right.score - left.score);

  const results: GalaxySearchResult[] = [];
  const seen = new Set<string>();

  for (const candidate of rankedContains) {
    if (candidate.score <= 0) {
      continue;
    }

    if (seen.has(candidate.doc.id)) {
      continue;
    }

    seen.add(candidate.doc.id);
    results.push({ node: candidate.doc.node, label: displayLabel(candidate.doc.node) });

    if (results.length >= limit) {
      return results;
    }
  }

  const fuzzy = index.fuse.search(trimmed, { limit: Math.max(limit * 2, limit) });
  for (const result of fuzzy) {
    if (seen.has(result.item.id)) {
      continue;
    }

    seen.add(result.item.id);
    results.push({
      node: result.item.node,
      label: displayLabel(result.item.node),
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}
