# Galaxy Data Contract

This document defines the contract for `apps/web/public/demo/nodes.json`.

## File Shape

`nodes.json` must be a JSON array of node objects.

```json
[
  {
    "id": "node-000001",
    "title": "Graph Retrieval for Vision-Language Models",
    "year": 2024,
    "cluster": 3,
    "x": 12.4,
    "y": -1.2,
    "z": 44.9,
    "size": 4.2,
    "isBridge": false,
    "url": "https://example.org/papers/node-000001"
  }
]
```

## Field Contract

- `id`: string, required, non-empty
- `title`: string, required, non-empty
- `year`: integer, optional
- `cluster`: integer, required
- `x`: number, required
- `y`: number, required
- `z`: number, required
- `size`: number, required, must be `> 0`
- `isBridge`: boolean, required
- `url`: string URL, optional

## Validation Behavior

UI validates using Zod with `safeParse`.

On invalid data, UI displays a friendly message:

- `Invalid nodes.json at "<path>": <issue>`

Example:

- `Invalid nodes.json at "[0].cluster": Expected number, received string`

## Runtime States

- Valid non-empty array -> render galaxy
- Valid empty array -> show empty state (`No nodes found`)
- Invalid JSON / schema mismatch / fetch error -> show error state with retry

## Common Errors

- `cluster` as string instead of integer
- `size` as `0` or negative
- malformed `url`
- top-level object instead of array
