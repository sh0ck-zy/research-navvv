import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import Fuse from 'fuse.js';

const filePath = path.resolve(process.cwd(), 'apps/web/public/demo/nodes.json');
const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const docs = payload.map((node) => {
  const authors = Array.isArray(node.authors)
    ? node.authors.join(', ')
    : typeof node.authors === 'string'
      ? node.authors
      : '';

  const title = node.title ?? '';
  const category = node.category ?? node.primaryCategory ?? node.clusterLabel ?? '';
  const abstract = (node.abstract ?? node.summary ?? '').slice(0, 240);

  return {
    id: node.id,
    title,
    category,
    authors,
    abstract,
    titleLower: title.toLowerCase(),
    categoryLower: category.toLowerCase(),
    authorsLower: authors.toLowerCase(),
    searchBlobLower: `${title} ${authors} ${category} ${abstract}`.toLowerCase(),
  };
});

const index = Fuse.createIndex(['title', 'authors', 'category', 'abstract'], docs);
const fuse = new Fuse(
  docs,
  {
    includeScore: true,
    threshold: 0.32,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'authors', weight: 0.2 },
      { name: 'category', weight: 0.2 },
      { name: 'abstract', weight: 0.1 },
    ],
  },
  index
);

function search(query, limit = 6) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const q = trimmed.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const seen = new Set();
  const out = [];

  const ranked = docs
    .map((doc) => {
      if (!tokens.every((token) => doc.searchBlobLower.includes(token))) {
        return null;
      }

      const titleMatch = doc.titleLower.includes(q);
      const categoryMatch = doc.categoryLower.includes(q);
      const authorsMatch = doc.authorsLower.includes(q);

      let score = 0;
      if (titleMatch) score += doc.titleLower.startsWith(q) ? 8 : 5;
      if (categoryMatch) score += 2;
      if (authorsMatch) score += 2;
      return { id: doc.id, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    if (item.score <= 0 || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item.id);
    if (out.length >= limit) return out;
  }

  const fuzzy = fuse.search(trimmed, { limit: Math.max(limit * 2, limit) });
  for (const hit of fuzzy) {
    if (seen.has(hit.item.id)) continue;
    seen.add(hit.item.id);
    out.push(hit.item.id);
    if (out.length >= limit) break;
  }

  return out;
}

const queries = ['transformer', 'retrieval', 'vision', 'language model', 'graph', 'security'];
const timings = [];

for (let i = 0; i < 300; i += 1) {
  const query = queries[i % queries.length];
  const t0 = performance.now();
  search(query, 6);
  const t1 = performance.now();
  timings.push(t1 - t0);
}

const sorted = [...timings].sort((a, b) => a - b);
const percentile = (p) => sorted[Math.floor((p / 100) * (sorted.length - 1))];

console.log(`nodes=${docs.length}`);
console.log(`p50=${percentile(50).toFixed(3)}ms`);
console.log(`p95=${percentile(95).toFixed(3)}ms`);
