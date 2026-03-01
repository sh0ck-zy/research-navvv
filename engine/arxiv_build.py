#!/usr/bin/env python3
"""Build arXiv galaxy demo data with a Milky Way-like spatial shape."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import re
from collections import Counter
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from pathlib import Path

ARXIV_SNAPSHOT_FILE = "arxiv-metadata-oai-snapshot.json"
DEFAULT_DATASET_ID = "Cornell-University/arxiv"
TEXT_DIMENSIONS = 96


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
for cluster_index, spec in enumerate(CLUSTER_SPECS):
  for category in spec.categories:
    CATEGORY_TO_CLUSTER[category] = cluster_index


@dataclass
class CandidatePaper:
  paper_id: str
  title: str
  authors: list[str]
  abstract: str
  year: int
  category: str
  cluster: int
  cluster_label: str
  bridge: bool
  token_count: int


def clean_whitespace(value: str | None) -> str:
  if not value:
    return ""
  return " ".join(value.split())


def truncate(value: str, max_length: int) -> str:
  if len(value) <= max_length:
    return value
  return value[: max_length - 3].rstrip() + "..."


def parse_authors(raw_authors: str | None) -> list[str]:
  compact = clean_whitespace(raw_authors)
  if compact == "":
    return []

  parts = re.split(r",|\band\b", compact, flags=re.IGNORECASE)
  authors = [part.strip() for part in parts if part.strip()]
  if len(authors) == 0:
    return [compact]

  return authors[:8]


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


def classify_categories(categories_raw: str) -> tuple[str, int, bool] | None:
  categories = [category for category in categories_raw.split() if category]
  primary_cluster = -1
  primary_category = ""

  for category in categories:
    mapped = CATEGORY_TO_CLUSTER.get(category)
    if mapped is not None:
      primary_cluster = mapped
      primary_category = category
      break

  if primary_cluster < 0:
    return None

  secondary_cluster_found = False
  for category in categories:
    mapped = CATEGORY_TO_CLUSTER.get(category)
    if mapped is not None and mapped != primary_cluster:
      secondary_cluster_found = True
      break

  return primary_category, primary_cluster, secondary_cluster_found


def tokenize(text: str) -> list[str]:
  return re.findall(r"[a-z0-9]{2,}", text.lower())


def stream_arxiv_records(metadata_path: Path):
  with metadata_path.open("r", encoding="utf-8") as handle:
    for line_number, line in enumerate(handle, start=1):
      try:
        payload = json.loads(line)
      except json.JSONDecodeError:
        if line_number <= 4:
          raise
        continue

      if isinstance(payload, dict):
        yield payload


def build_candidate(record: dict[str, object], min_year: int, max_year: int) -> CandidatePaper | None:
  title_raw = record.get("title") if isinstance(record.get("title"), str) else ""
  title = truncate(clean_whitespace(title_raw), 180)
  if len(title) < 12:
    return None

  abstract_raw = record.get("abstract") if isinstance(record.get("abstract"), str) else ""
  abstract = truncate(clean_whitespace(abstract_raw), 560)
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
  if not isinstance(paper_id, str) or paper_id == "":
    return None

  category, cluster, bridge = classification
  authors = parse_authors(record.get("authors") if isinstance(record.get("authors"), str) else None)
  token_count = len(tokenize(f"{title} {abstract}"))

  return CandidatePaper(
      paper_id=paper_id,
      title=title,
      authors=authors,
      abstract=abstract,
      year=year,
      category=category,
      cluster=cluster,
      cluster_label=CLUSTER_SPECS[cluster].label,
      bridge=bridge,
      token_count=token_count,
  )


def sample_balanced_papers(metadata_path: Path, count: int, seed: int, min_year: int, max_year: int) -> list[CandidatePaper]:
  rng = random.Random(seed)
  cluster_count = len(CLUSTER_SPECS)

  targets = [count // cluster_count] * cluster_count
  for index in range(count % cluster_count):
    targets[index] += 1

  buckets: list[list[CandidatePaper]] = [[] for _ in range(cluster_count)]
  seen_per_cluster = [0] * cluster_count

  fallback_capacity = max(count * 3, count + 64)
  fallback_pool: list[CandidatePaper] = []
  fallback_seen = 0

  for record in stream_arxiv_records(metadata_path):
    candidate = build_candidate(record, min_year=min_year, max_year=max_year)
    if candidate is None:
      continue

    fallback_seen += 1
    if len(fallback_pool) < fallback_capacity:
      fallback_pool.append(candidate)
    else:
      slot = rng.randrange(fallback_seen)
      if slot < fallback_capacity:
        fallback_pool[slot] = candidate

    cluster = candidate.cluster
    seen_per_cluster[cluster] += 1
    target = targets[cluster]

    if len(buckets[cluster]) < target:
      buckets[cluster].append(candidate)
      continue

    slot = rng.randrange(seen_per_cluster[cluster])
    if slot < target:
      buckets[cluster][slot] = candidate

  selected = [paper for bucket in buckets for paper in bucket]
  if len(selected) < count:
    seen_ids = {paper.paper_id for paper in selected}
    rng.shuffle(fallback_pool)

    for paper in fallback_pool:
      if paper.paper_id in seen_ids:
        continue
      selected.append(paper)
      seen_ids.add(paper.paper_id)
      if len(selected) >= count:
        break

  if len(selected) < count:
    raise ValueError(f"Only found {len(selected)} papers but requested {count}.")

  rng.shuffle(selected)
  return selected[:count]


def stable_hash_int(value: str) -> int:
  digest = hashlib.blake2b(value.encode("utf-8"), digest_size=8).digest()
  return int.from_bytes(digest, byteorder="big", signed=False)


def text_feature_vector(paper: CandidatePaper, dimensions: int) -> list[float]:
  counter = Counter(tokenize(f"{paper.title} {paper.abstract} {paper.category} {' '.join(paper.authors)}"))
  vector = [0.0] * dimensions

  total_tokens = sum(counter.values())
  norm = math.sqrt(total_tokens) if total_tokens > 0 else 1.0

  for token, freq in counter.items():
    token_hash = stable_hash_int(token)
    slot = token_hash % dimensions
    signed = -1.0 if ((token_hash >> 7) & 1) else 1.0
    weight = (1.0 + math.log(freq)) / norm
    vector[slot] += signed * weight

  category_boost_slot = stable_hash_int(f"cat:{paper.category}") % dimensions
  vector[category_boost_slot] += 0.85

  if paper.bridge:
    bridge_slot = stable_hash_int("bridge") % dimensions
    vector[bridge_slot] += 0.5

  return vector


def build_projection_matrix(dimensions: int, seed: int) -> list[list[float]]:
  rng = random.Random(seed * 17 + 31)
  matrix: list[list[float]] = []
  for _ in range(3):
    row = [rng.gauss(0.0, 1.0 / math.sqrt(dimensions)) for _ in range(dimensions)]
    matrix.append(row)
  return matrix


def project_vector(vector: list[float], matrix: list[list[float]]) -> tuple[float, float, float]:
  coords = [0.0, 0.0, 0.0]

  for dim, value in enumerate(vector):
    coords[0] += value * matrix[0][dim]
    coords[1] += value * matrix[1][dim]
    coords[2] += value * matrix[2][dim]

  return coords[0], coords[1], coords[2]


def normalize_coordinates(coords: list[tuple[float, float, float]]) -> list[tuple[float, float, float]]:
  if len(coords) == 0:
    return []

  means = [sum(point[axis] for point in coords) / len(coords) for axis in range(3)]

  stds = []
  for axis in range(3):
    variance = sum((point[axis] - means[axis]) ** 2 for point in coords) / max(1, len(coords) - 1)
    stds.append(math.sqrt(variance) if variance > 1e-9 else 1.0)

  normalized: list[tuple[float, float, float]] = []
  for x, y, z in coords:
    normalized.append(((x - means[0]) / stds[0], (y - means[1]) / stds[1], (z - means[2]) / stds[2]))

  return normalized


def shape_milky_way(points: list[tuple[float, float, float]], papers: list[CandidatePaper], seed: int) -> tuple[list[dict[str, float]], list[float]]:
  shaped: list[dict[str, float]] = []
  weights: list[float] = []

  global_rng = random.Random(seed)
  phi1 = global_rng.uniform(0, math.pi * 2)
  phi2 = global_rng.uniform(0, math.pi * 2)

  for index, (x, y, z) in enumerate(points):
    paper = papers[index]
    rng = random.Random(f"{seed}:{paper.paper_id}:shape")

    y_compressed = y * 0.12
    r = math.hypot(x, z)

    w_disk = math.exp(-r / 0.70)
    w_core = math.exp(-(r ** 2) / (2 * 0.12 ** 2))

    sigma_y = 0.004 + 0.018 * r
    y_final = y_compressed + rng.gauss(0.0, sigma_y)

    theta = math.atan2(z, x if abs(x) > 1e-6 else 1e-6)

    r_prime = r + 0.03 * math.sin(2 * theta + phi1) + 0.015 * math.sin(4 * theta + phi2)

    x_final = r_prime * math.cos(theta)
    z_final = r_prime * math.sin(theta)

    scale = 100.0
    x_scaled = x_final * scale
    y_scaled = y_final * scale
    z_scaled = z_final * scale

    shaped.append({"x": x_scaled, "y": y_scaled, "z": z_scaled})
    weights.append(0.75 * w_disk + 1.35 * w_core)

  return shaped, weights


def resolve_arxiv_metadata_path(dataset_id: str, dataset_path: Path | None) -> Path:
  if dataset_path is not None:
    if dataset_path.is_file():
      return dataset_path

    candidate = dataset_path / ARXIV_SNAPSHOT_FILE
    if candidate.is_file():
      return candidate

    raise FileNotFoundError(f"Could not find {ARXIV_SNAPSHOT_FILE} in {dataset_path}")

  try:
    import kagglehub
  except ModuleNotFoundError as exc:
    raise ModuleNotFoundError(
        "kagglehub is required when --dataset-path is not provided. "
        "Install kagglehub or pass --dataset-path to a local snapshot file."
    ) from exc

  root = Path(kagglehub.dataset_download(dataset_id))
  candidate = root / ARXIV_SNAPSHOT_FILE

  if not candidate.is_file():
    raise FileNotFoundError(f"Dataset downloaded to {root}, but {ARXIV_SNAPSHOT_FILE} was not found.")

  return candidate


def build_nodes(papers: list[CandidatePaper], seed: int) -> list[dict[str, object]]:
  projection_matrix = build_projection_matrix(TEXT_DIMENSIONS, seed)
  feature_vectors = [text_feature_vector(paper, TEXT_DIMENSIONS) for paper in papers]
  projected = [project_vector(vector, projection_matrix) for vector in feature_vectors]
  normalized = normalize_coordinates(projected)

  shaped, weights = shape_milky_way(normalized, papers, seed)

  max_w = max(weights) if weights else 1.0
  min_w = min(weights) if weights else 0.0
  range_w = max_w - min_w if max_w > min_w else 1.0
  normalized_weights = [(w - min_w) / range_w for w in weights]

  ranked_indices = sorted(range(len(papers)), key=lambda i: normalized_weights[i], reverse=True)
  
  n_papers = len(papers)
  bright_cutoff = int(n_papers * 0.02)
  star_cutoff = bright_cutoff + int(n_papers * 0.18)

  layer_assignment = [""] * n_papers
  for rank, original_index in enumerate(ranked_indices):
    if rank < bright_cutoff:
      layer_assignment[original_index] = "bright"
    elif rank < star_cutoff:
      layer_assignment[original_index] = "star"
    else:
      layer_assignment[original_index] = "dust"

  nodes: list[dict[str, object]] = []

  for index, paper in enumerate(papers):
    rng = random.Random(f"{seed}:{paper.paper_id}:visuals")
    layer = layer_assignment[index]

    if layer == "dust":
      alpha_base = rng.uniform(0.02, 0.06)
      size_base = rng.uniform(0.35, 0.65)
    elif layer == "star":
      alpha_base = rng.uniform(0.08, 0.18)
      size_base = rng.uniform(0.70, 1.10)
    else:
      alpha_base = rng.uniform(0.22, 0.42)
      size_base = rng.uniform(1.25, 2.25)

    coords = shaped[index]

    nodes.append(
        {
            "id": paper.paper_id,
            "title": paper.title,
            "year": paper.year,
            "category": paper.category,
            "authors": paper.authors,
            "abstract": paper.abstract,
            "cluster": paper.cluster,
            "clusterLabel": paper.cluster_label,
            "x": round(coords["x"], 4),
            "y": round(coords["y"], 4),
            "z": round(coords["z"], 4),
            "size": round(size_base, 3),
            "sizeBase": round(size_base, 3),
            "alphaBase": round(alpha_base, 3),
            "layer": layer,
            "isBridge": paper.bridge,
            "url": f"https://arxiv.org/abs/{paper.paper_id}",
        }
    )

  N_dust_extra = len(papers) * 6
  Rmax = 350.0

  for i in range(N_dust_extra):
     rng = random.Random(f"{seed}:dust:{i}")
     theta = rng.uniform(0, 2 * math.pi)
     r_norm = (rng.random() ** 2.4)
     r = r_norm * Rmax
     
     r_unscaled = r / 100.0
     sigma_y = 0.004 + 0.018 * r_unscaled
     y_unscaled = rng.gauss(0.0, sigma_y)
     
     x = r * math.cos(theta)
     z = r * math.sin(theta)
     y = y_unscaled * 100.0
     
     alpha_base = rng.uniform(0.02, 0.06)
     size_base = rng.uniform(0.30, 0.65)
     
     cluster_index = rng.randrange(len(CLUSTER_SPECS))
     
     nodes.append(
         {
             "id": f"dust_{i}",
             "title": "",
             "year": 0,
             "category": CLUSTER_SPECS[cluster_index].categories[0],
             "authors": [],
             "abstract": "",
             "cluster": cluster_index,
             "clusterLabel": CLUSTER_SPECS[cluster_index].label,
             "x": round(x, 4),
             "y": round(y, 4),
             "z": round(z, 4),
             "size": round(size_base, 3),
             "sizeBase": round(size_base, 3),
             "alphaBase": round(alpha_base, 3),
             "layer": "dust",
             "isBridge": False,
             "url": "",
             "isAmbient": True
         }
     )

  return nodes


def main() -> None:
  parser = argparse.ArgumentParser(description="Build arXiv-based galaxy nodes with Milky Way shaping")
  parser.add_argument("--seed", type=int, default=42)
  parser.add_argument("--count", type=int, default=2000)
  parser.add_argument("--output", type=Path, required=True)
  parser.add_argument("--dataset-id", default=DEFAULT_DATASET_ID)
  parser.add_argument("--dataset-path", type=Path)
  parser.add_argument("--min-year", type=int, default=2018)
  parser.add_argument("--max-year", type=int, default=2025)
  args = parser.parse_args()

  args.output.parent.mkdir(parents=True, exist_ok=True)

  metadata_path = resolve_arxiv_metadata_path(dataset_id=args.dataset_id, dataset_path=args.dataset_path)
  papers = sample_balanced_papers(
      metadata_path=metadata_path,
      count=args.count,
      seed=args.seed,
      min_year=args.min_year,
      max_year=args.max_year,
  )
  nodes = build_nodes(papers, args.seed)

  args.output.write_text(json.dumps(nodes, indent=2) + "\n", encoding="utf-8")
  print(f"Wrote {len(nodes)} nodes to {args.output}")


if __name__ == "__main__":
  main()
