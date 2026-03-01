import type { GalaxyNode } from '../../lib/galaxy/schema';

interface GalaxySidePanelProps {
  node: GalaxyNode | null;
  onClose: () => void;
}

export function GalaxySidePanel({ node, onClose }: GalaxySidePanelProps) {
  const domain = node ? node.clusterLabel ?? node.category ?? `Cluster ${node.cluster}` : null;

  return (
    <aside className="pointer-events-auto absolute right-6 top-6 z-20 w-[min(320px,calc(100%-3rem))] rounded-xl bg-slate-950/40 p-5 text-slate-100 shadow-lg backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">Paper details</h2>
        {node ? (
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
          >
            Close
          </button>
        ) : null}
      </div>

      {!node ? (
        <div className="space-y-2 text-sm text-slate-300">
          <p>Select any paper to inspect context.</p>
          <p className="text-slate-400">Bridge-focused papers connect two or more research domains.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-[14px] font-medium leading-snug text-slate-100">{node.title}</p>
            {node.authors ? <p className="mt-2 text-[12px] text-slate-400">{node.authors.join(', ')}</p> : null}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 tracking-wide">
            {domain ? <span>{domain}</span> : null}
            {node.category ? (
              <span>
                &middot; {node.category}
              </span>
            ) : null}
            {node.year ? (
              <span>&middot; {node.year}</span>
            ) : null}
            {node.isBridge ? (
              <span className="text-amber-200/70">&middot; Bridge paper</span>
            ) : null}
          </div>

          {node.abstract ? <p className="text-[12px] leading-relaxed text-slate-400">{node.abstract}</p> : null}

          {node.url ? (
            <a
              href={node.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-[12px] text-slate-300 underline-offset-4 hover:text-white hover:underline transition-all"
            >
              Open on arXiv &rarr;
            </a>
          ) : (
            <p className="text-xs text-slate-400">No URL available for this paper.</p>
          )}
        </div>
      )}
    </aside>
  );
}
