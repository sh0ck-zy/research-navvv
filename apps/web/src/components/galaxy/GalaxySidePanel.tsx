import type { GalaxyNode } from '../../lib/galaxy/schema';

interface GalaxySidePanelProps {
  node: GalaxyNode | null;
  onClose: () => void;
}

export function GalaxySidePanel({ node, onClose }: GalaxySidePanelProps) {
  return (
    <aside className="pointer-events-auto absolute right-4 top-4 z-20 w-[min(360px,calc(100%-2rem))] rounded-2xl border border-cyan-200/30 bg-slate-950/85 p-4 text-slate-100 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100/85">Paper</h2>
        {node ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-cyan-200/25 px-2 py-1 text-xs text-cyan-100 hover:border-cyan-200/50"
          >
            Esc
          </button>
        ) : null}
      </div>

      {!node ? (
        <p className="text-sm text-slate-300">Click a node to inspect details.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-base font-semibold leading-snug text-slate-50">{node.title}</p>
          <p className="text-sm text-slate-300">{node.year ? `Year ${node.year}` : 'Year unknown'}</p>
          <p className="text-sm text-slate-300">Cluster {node.cluster}</p>
          {node.url ? (
            <a
              href={node.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-cyan-200/35 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:border-cyan-200/55"
            >
              Open paper
            </a>
          ) : (
            <p className="text-xs text-slate-400">No URL available for this paper.</p>
          )}
        </div>
      )}
    </aside>
  );
}
