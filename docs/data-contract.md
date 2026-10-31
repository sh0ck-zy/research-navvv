# Galaxy Data Contract

This document defines the contract for `apps/web/public/demo/nodes.json`.

## File Shape

`nodes.json` must be a JSON array of node objects.

```json
[
  {
    "id": "2403.01067",
    "title": "Scaling Sparse Expert Models",
    "year": 2024,
    "category": "cs.LG",
    "authors": ["Jane Doe", "John Roe"],
    "abstract": "Sparse MoE models improve quality while controlling compute...",
    "cluster": 0,
    "clusterLabel": "Machine Learning",
    "x": 12.4,
    "y": -1.2,
    "z": 44.9,
    "size": 3.8,
    "sizeBase": 1.7,
    "alphaBase": 0.56,
    "layer": "bright",
    "isBridge": false,
    "url": "https://arxiv.org/abs/2403.01067"
  }
]
```

## Field Contract

- `id`: string, required, non-empty
- `title`: string, required, non-empty
- `year`: integer, optional
- `category`: string, optional
- `authors`: string array, optional
- `abstract`: string, optional
- `cluster`: integer, required
- `clusterLabel`: string, optional
- `x`: number, required
- `y`: number, required
- `z`: number, required
- `size`: number, required, must be `> 0`
- `sizeBase`: number, optional, must be `> 0`
- `alphaBase`: number, optional, range `0..1`
- `layer`: `dust | star | bright`, optional
- `isBridge`: boolean, required
- `url`: string URL, optional

## Semantic Scope

- `nodes.json` is **paper-only semantic data**.
- Ambient/atmospheric particles are renderer-generated and are **not** stored in `nodes.json`.
- Synthetic IDs such as `dust_*` are invalid in generated demo data.

## Legacy Compatibility

Loader normalizes legacy fields before validation:

- `summary` -> `abstract`
- `primaryCategory` -> `category`
- `authors` string -> `authors[]`
- legacy `isAmbient: true` nodes are dropped during load

## Runtime States

- Valid non-empty array -> render galaxy
- Valid empty array -> show empty state
- Invalid JSON / schema mismatch / fetch error -> show error state with retry
