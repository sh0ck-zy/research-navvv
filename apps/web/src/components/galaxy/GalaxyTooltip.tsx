import type { GalaxyNode } from '../../lib/galaxy/schema';

interface GalaxyTooltipProps {
  node: GalaxyNode;
  x: number;
  y: number;
}

export function GalaxyTooltip({ node, x, y }: GalaxyTooltipProps) {
  return (
    <div
      className="pointer-events-none fixed z-30 max-w-[320px] rounded-xl border border-cyan-200/35 bg-slate-950/90 px-3 py-2 text-xs text-slate-100 shadow-xl backdrop-blur"
      style={{ left: x + 12, top: y + 12, transform: 'translate3d(0,0,0)', transition: 'opacity 120ms ease, transform 120ms ease' }}
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold text-cyan-100">{node.title}</p>
      <p className="mt-1 text-slate-300">
        Cluster {node.cluster}
        {node.year ? ` · ${node.year}` : ''}
      </p>
    </div>
  );
}
