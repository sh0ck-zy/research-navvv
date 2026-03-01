#!/usr/bin/env python3
"""Generate deterministic galaxy nodes for Navvv."""

from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from pathlib import Path

ARXIV_SNAPSHOT_FILE = "arxiv-metadata-oai-snapshot.json"
DEFAULT_DATASET_ID = "Cornell-University/arxiv"


@dataclass(frozen=True)
class ClusterSpec:
  label: str
  categories: tuple[str, ...]


CLUSTER_SPECS = [
    ClusterSpec("Machine Learning", ("cs.LG", "stat.ML", "cs.NE")),
    ClusterSpec("Vision", ("cs.CV", "eess.IV")),
    ClusterSpec("Language", ("cs.CL", "cs.AI")),
    ClusterSpec("Robotics", ("cs.RO", "cs.MA")),
    ClusterSpec("Retrieval", ("cs.IR", "cs.DB", "cs.DL")),
    ClusterSpec("Systems", ("cs.DC", "cs.NI", "cs.OS", "cs.SE", "cs.AR")),
    ClusterSpec("Security", ("cs.CR", "cs.CY")),
    ClusterSpec("Theory", ("cs.DS", "cs.CC", "cs.LO", "math.OC", "cs.GT")),
]

CATEGORY_TO_CLUSTER: dict[str, int] = {}
for index, spec in enumerate(CLUSTER_SPECS):
  for category in spec.categories:
    CATEGORY_TO_CLUSTER[category] = index


@dataclass
class CandidatePaper:
  paper_id: str
  title: str
  authors: str
  summary: str
  year: int
  primary_category: str
  cluster: int
  secondary_cluster: int | None
  is_bridge: bool


def clean_whitespace(value: str | None) -> str:
  if not value:
    return ""
  return " ".join(value.split())


def truncate(value: str, max_length: int) -> str:
  if len(value) <= max_length:
    return value
  return value[: max_length - 3].rstrip() + "..."


def compact_authors(raw_authors: str) -> str:
  value = clean_whitespace(raw_authors)
  if len(value) <= 110:
    return value

  separators = [",", " and "]
  names = [value]
  for separator in separators:
    expanded: list[str] = []
    for chunk in names:
      expanded.extend(chunk.split(separator))
    names = expanded

  compacted = [name.strip() for name in names if name.strip()]
  if len(compacted) >= 4:
    return ", ".join(compacted[:3]) + ", et al."

  return truncate(value, 110)


def extract_year(record: dict[str, object]) -> int | None:
  versions = record.get("versions")
  if isinstance(versions, list) and versions:
    first = versions[0]
    if isinstance(first, dict):
      created = first.get("created")
      if isinstance(created, str):
        try:
          return parsedate_to_datetime(created).year
        except (TypeError, ValueError):
          pass

  update_date = record.get("update_date")
  if isinstance(update_date, str) and len(update_date) >= 4 and update_date[:4].isdigit():
    return int(update_date[:4])

  return None


def classify_categories(categories_raw: str) -> tuple[str, int, int | None, bool] | None:
  codes = [code for code in categories_raw.split() if code]
  primary_code = ""
  primary_cluster = -1

  for code in codes:
    mapped = CATEGORY_TO_CLUSTER.get(code)
    if mapped is not None:
      primary_code = code
      primary_cluster = mapped
      break

  if primary_cluster < 0:
    return None

  secondary_cluster: int | None = None
  for code in codes:
    mapped = CATEGORY_TO_CLUSTER.get(code)
    if mapped is not None and mapped != primary_cluster:
      secondary_cluster = mapped
      break

  return primary_code, primary_cluster, secondary_cluster, secondary_cluster is not None


def build_candidate(record: dict[str, object], min_year: int, max_year: int) -> CandidatePaper | None:
  title = truncate(clean_whitespace(record.get("title") if isinstance(record.get("title"), str) else ""), 180)
  if len(title) < 12:
    return None

  abstract = clean_whitespace(record.get("abstract") if isinstance(record.get("abstract"), str) else "")
  if len(abstract) < 80:
    return None

  categories = record.get("categories")
  if not isinstance(categories, str):
    return None

  classification = classify_categories(categories)
  if classification is None:
    return None

  year = extract_year(record)
  if year is None or year < min_year or year > max_year:
    return None

  paper_id = record.get("id")
  if not isinstance(paper_id, str) or not paper_id:
    return None

  primary_category, cluster, secondary_cluster, is_bridge = classification

  return CandidatePaper(
      paper_id=paper_id,
      title=title,
      authors=compact_authors(record.get("authors") if isinstance(record.get("authors"), str) else "Unknown authors"),
      summary=truncate(abstract, 420),
      year=year,
      primary_category=primary_category,
      cluster=cluster,
      secondary_cluster=secondary_cluster,
      is_bridge=is_bridge,
  )


def stream_arxiv_records(metadata_path: Path):
  with metadata_path.open("r", encoding="utf-8") as handle:
    for line_number, line in enumerate(handle, start=1):
      try:
        payload = json.loads(line)
      except json.JSONDecodeError:
        if line_number > 4:
          continue
        raise

      if isinstance(payload, dict):
        yield payload


def sample_arxiv_papers(metadata_path: Path, count: int, seed: int, min_year: int, max_year: int) -> list[CandidatePaper]:
  if count <= 0:
    return []

  cluster_count = len(CLUSTER_SPECS)
  targets = [count // cluster_count] * cluster_count
  for i in range(count % cluster_count):
    targets[i] += 1

  rng = random.Random(seed)
  buckets: list[list[CandidatePaper]] = [[] for _ in range(cluster_count)]
  seen_per_cluster = [0] * cluster_count

  backfill_capacity = max(count * 3, count + 100)
  backfill_pool: list[CandidatePaper] = []
  backfill_seen = 0

  for record in stream_arxiv_records(metadata_path):
    candidate = build_candidate(record, min_year=min_year, max_year=max_year)
    if candidate is None:
      continue

    backfill_seen += 1
    if len(backfill_pool) < backfill_capacity:
      backfill_pool.append(candidate)
    else:
      slot = rng.randrange(backfill_seen)
      if slot < backfill_capacity:
        backfill_pool[slot] = candidate

    cluster = candidate.cluster
    seen_per_cluster[cluster] += 1

    target = targets[cluster]
    bucket = buckets[cluster]

    if len(bucket) < target:
      bucket.append(candidate)
      continue

    slot = rng.randrange(seen_per_cluster[cluster])
    if slot < target:
      bucket[slot] = candidate

  selected = [paper for bucket in buckets for paper in bucket]
  if len(selected) < count:
    selected_ids = {paper.paper_id for paper in selected}
    rng.shuffle(backfill_pool)
    for paper in backfill_pool:
      if paper.paper_id in selected_ids:
        continue
      selected.append(paper)
      selected_ids.add(paper.paper_id)
      if len(selected) >= count:
        break

  if len(selected) < count:
    raise ValueError(
        "Not enough arXiv papers matched the requested filters. "
        f"Found {len(selected)} papers, requested {count}."
    )

  rng.shuffle(selected)
  return selected[:count]


def cluster_centers() -> list[tuple[float, float, float]]:
  centers: list[tuple[float, float, float]] = []
  total = len(CLUSTER_SPECS)

  for cluster in range(total):
    angle = (cluster / total) * math.tau - math.pi / 2
    radius = 72.0 + (cluster % 2) * 8.5
    x = math.cos(angle) * radius
    y = ((cluster % 3) - 1) * 1.4
    z = math.sin(angle) * radius
    centers.append((x, y, z))

  return centers


def build_arxiv_nodes(papers: list[CandidatePaper], seed: int) -> list[dict[str, object]]:
  centers = cluster_centers()
  year_values = [paper.year for paper in papers]
  min_year = min(year_values)
  max_year = max(year_values)
  span = max(1, max_year - min_year)

  nodes: list[dict[str, object]] = []
  for paper in papers:
    local_rng = random.Random(f"{seed}:{paper.paper_id}")

    cx, cy, cz = centers[paper.cluster]
    spread = 7.0 + (paper.cluster % 4) * 1.6
    local_angle = local_rng.random() * math.tau
    local_radius = abs(local_rng.gauss(0.0, spread))

    x = cx + math.cos(local_angle) * local_radius
    z = cz + math.sin(local_angle) * local_radius

    year_ratio = (paper.year - min_year) / span
    y = -11.0 + year_ratio * 22.0 + cy + local_rng.gauss(0.0, 1.6)

    if paper.is_bridge and paper.secondary_cluster is not None:
      sx, sy, sz = centers[paper.secondary_cluster]
      bridge_mix = 0.3 + local_rng.random() * 0.28
      x = cx * (1 - bridge_mix) + sx * bridge_mix + local_rng.gauss(0.0, 1.8)
      y = y * (1 - bridge_mix) + sy * bridge_mix + local_rng.gauss(0.0, 1.2)
      z = cz * (1 - bridge_mix) + sz * bridge_mix + local_rng.gauss(0.0, 1.8)

    word_count = len(paper.summary.split())
    size = 2.1 + min(2.8, word_count / 42)
    if paper.is_bridge:
      size += 0.75
    size += local_rng.uniform(-0.15, 0.3)
    size = max(1.9, min(6.3, size))

    nodes.append(
        {
            "id": paper.paper_id,
            "title": paper.title,
            "authors": paper.authors,
            "summary": paper.summary,
            "year": paper.year,
            "cluster": paper.cluster,
            "clusterLabel": CLUSTER_SPECS[paper.cluster].label,
            "primaryCategory": paper.primary_category,
            "x": round(x, 4),
            "y": round(y, 4),
            "z": round(z, 4),
            "size": round(size, 3),
            "isBridge": paper.is_bridge,
            "url": f"https://arxiv.org/abs/{paper.paper_id}",
        }
    )

  return nodes


def resolve_arxiv_metadata_path(dataset_id: str, dataset_path: Path | None) -> Path:
  if dataset_path is not None:
    if dataset_path.is_file():
      return dataset_path
    candidate = dataset_path / ARXIV_SNAPSHOT_FILE
    if candidate.is_file():
      return candidate
    raise FileNotFoundError(f"Could not find arXiv snapshot in {dataset_path}.")

  try:
    import kagglehub
  except ModuleNotFoundError as exc:
    raise ModuleNotFoundError(
        "kagglehub is required when --dataset-path is not provided. "
        "Install it or pass --dataset-path to a local snapshot file."
    ) from exc

  root = Path(kagglehub.dataset_download(dataset_id))
  metadata_path = root / ARXIV_SNAPSHOT_FILE
  if not metadata_path.is_file():
    raise FileNotFoundError(
        f"Downloaded dataset at {root}, but {ARXIV_SNAPSHOT_FILE} was not found."
    )

  return metadata_path


def build_synthetic_nodes(seed: int, count: int) -> list[dict[str, object]]:
  rng = random.Random(seed)
  cluster_count = max(6, min(14, count // 150))
  bridges_ratio = rng.uniform(0.01, 0.03)
  bridges_target = max(1, int(count * bridges_ratio))

  centers: list[tuple[float, float, float]] = []
  for cluster in range(cluster_count):
    angle = (cluster / cluster_count) * math.tau
    radius = 55 + (cluster % 3) * 24
    x = math.cos(angle) * radius
    y = rng.uniform(-8.0, 8.0)
    z = math.sin(angle) * radius
    centers.append((x, y, z))

  bridge_indexes = set(rng.sample(range(count), k=bridges_target))

  topics = [
      "Graph Retrieval",
      "Multimodal Reasoning",
      "Vision Transformers",
      "Foundation Models",
      "Scientific Agents",
      "Long Context",
      "Benchmarking",
      "Embeddings",
      "RAG Systems",
      "Causal Inference",
  ]

  nodes: list[dict[str, object]] = []
  for i in range(count):
    node_id = f"synthetic-{i + 1:06d}"
    cluster = i % cluster_count
    cx, cy, cz = centers[cluster]

    spread = 6.0 + (cluster % 4) * 1.8
    x = cx + rng.gauss(0.0, spread)
    y = cy + rng.gauss(0.0, 3.2)
    z = cz + rng.gauss(0.0, spread)

    year = rng.randint(2016, 2026)
    topic = topics[(cluster + i) % len(topics)]

    is_bridge = i in bridge_indexes
    if is_bridge:
      next_cluster = (cluster + 1) % cluster_count
      nx, ny, nz = centers[next_cluster]
      t = rng.uniform(0.35, 0.65)
      x = cx * (1 - t) + nx * t + rng.gauss(0.0, 3.0)
      y = cy * (1 - t) + ny * t + rng.gauss(0.0, 2.2)
      z = cz * (1 - t) + nz * t + rng.gauss(0.0, 3.0)

    node = {
        "id": node_id,
        "title": f"{topic} Prototype {i + 1}",
        "year": year,
        "cluster": cluster,
        "x": round(x, 4),
        "y": round(y, 4),
        "z": round(z, 4),
        "size": round(rng.uniform(2.0, 5.8), 3),
        "isBridge": is_bridge,
    }

    nodes.append(node)

  return nodes


def main() -> None:
  parser = argparse.ArgumentParser(description="Build deterministic galaxy nodes.json")
  parser.add_argument("--seed", type=int, default=42)
  parser.add_argument("--count", type=int, default=2000)
  parser.add_argument("--output", type=Path, required=True)
  parser.add_argument("--source", choices=("arxiv", "synthetic"), default="arxiv")
  parser.add_argument("--dataset-id", default=DEFAULT_DATASET_ID)
  parser.add_argument("--dataset-path", type=Path)
  parser.add_argument("--min-year", type=int, default=2018)
  parser.add_argument("--max-year", type=int, default=2025)
  args = parser.parse_args()

  args.output.parent.mkdir(parents=True, exist_ok=True)

  if args.source == "synthetic":
    payload = build_synthetic_nodes(seed=args.seed, count=args.count)
  else:
    metadata_path = resolve_arxiv_metadata_path(dataset_id=args.dataset_id, dataset_path=args.dataset_path)
    papers = sample_arxiv_papers(
        metadata_path=metadata_path,
        count=args.count,
        seed=args.seed,
        min_year=args.min_year,
        max_year=args.max_year,
    )
    payload = build_arxiv_nodes(papers=papers, seed=args.seed)

  args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
  print(f"Wrote {len(payload)} nodes to {args.output}")


if __name__ == "__main__":
  main()
