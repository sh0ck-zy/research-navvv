#!/usr/bin/env python3
"""Generate deterministic demo nodes for Navvv Galaxy."""

from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path


def build_nodes(seed: int, count: int) -> list[dict[str, object]]:
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
    node_id = f"node-{i + 1:06d}"
    cluster = i % cluster_count
    cx, cy, cz = centers[cluster]

    # Compact cluster cloud with small depth variance.
    spread = 6.0 + (cluster % 4) * 1.8
    x = cx + rng.gauss(0.0, spread)
    y = cy + rng.gauss(0.0, 3.2)
    z = cz + rng.gauss(0.0, spread)

    year = rng.randint(2016, 2026)
    topic = topics[(cluster + i) % len(topics)]
    title = f"{topic} Study {i + 1}"

    is_bridge = i in bridge_indexes
    if is_bridge:
      # Pull bridge points toward inter-cluster regions.
      next_cluster = (cluster + 1) % cluster_count
      nx, ny, nz = centers[next_cluster]
      t = rng.uniform(0.35, 0.65)
      x = cx * (1 - t) + nx * t + rng.gauss(0.0, 3.0)
      y = cy * (1 - t) + ny * t + rng.gauss(0.0, 2.2)
      z = cz * (1 - t) + nz * t + rng.gauss(0.0, 3.0)

    node = {
        "id": node_id,
        "title": title,
        "year": year,
        "cluster": cluster,
        "x": round(x, 4),
        "y": round(y, 4),
        "z": round(z, 4),
        "size": round(rng.uniform(2.0, 5.8), 3),
        "isBridge": is_bridge,
    }

    if rng.random() < 0.72:
      node["url"] = f"https://example.org/papers/{node_id}"

    nodes.append(node)

  return nodes


def main() -> None:
  parser = argparse.ArgumentParser(description="Build deterministic demo nodes.json")
  parser.add_argument("--seed", type=int, default=42)
  parser.add_argument("--count", type=int, default=2000)
  parser.add_argument("--output", type=Path, required=True)
  args = parser.parse_args()

  args.output.parent.mkdir(parents=True, exist_ok=True)
  payload = build_nodes(seed=args.seed, count=args.count)
  args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
  main()
