import type { GalaxyNode } from '../../lib/galaxy/schema';

interface GalaxyTooltipProps {
  node: GalaxyNode;
  x: number;
  y: number;
}

export function GalaxyTooltip({ node, x, y }: GalaxyTooltipProps) {
  const domain = node.clusterLabel ?? node.category ?? `Cluster ${node.cluster}`;

  return (
    <div
      className="pointer-events-none fixed z-30 max-w-[340px] rounded-lg bg-slate-950/40 px-3 py-2 text-[11px] text-slate-100 shadow-md backdrop-blur-md"
      style={{ left: x + 12, top: y + 12, transform: 'translate3d(0,0,0)', transition: 'opacity 120ms ease, transform 120ms ease' }}
      role="status"
      aria-live="polite"
    >
      <p className="font-medium text-slate-100">{node.title}</p>
      <p className="mt-1 text-slate-400">{domain}{node.category ? ` · ${node.category}` : ''}</p>
      {node.year ? <p className="text-slate-500">{node.year}</p> : null}
    </div>
  );
}
