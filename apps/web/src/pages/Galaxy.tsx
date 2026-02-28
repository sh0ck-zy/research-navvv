import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GalaxyCanvas } from '../components/galaxy/GalaxyCanvas';
import { GalaxyControls } from '../components/galaxy/GalaxyControls';
import { GalaxyHelpOverlay } from '../components/galaxy/GalaxyHelpOverlay';
import { GalaxySidePanel } from '../components/galaxy/GalaxySidePanel';
import { GalaxyTooltip } from '../components/galaxy/GalaxyTooltip';
import { loadGalaxyNodes } from '../lib/galaxy/loadNodes';
import type { GalaxyNode } from '../lib/galaxy/schema';

interface HoverState {
  node: GalaxyNode;
  x: number;
  y: number;
}

const LARGE_DATASET_LIMIT = 20_000;

export function GalaxyPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GalaxyNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<GalaxyNode | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [bridgesMode, setBridgesMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    const result = await loadGalaxyNodes(signal);

    if (result.status === 'error') {
      setNodes([]);
      setError(result.message);
    } else {
      setNodes(result.nodes);
      setError(null);
    }

    setSelectedNode(null);
    setHover(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, reloadKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?') {
        event.preventDefault();
        setHelpOpen((value) => !value);
        return;
      }

      if (event.key === 'Escape') {
        setHelpOpen(false);
        setSelectedNode(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const largeDataset = nodes.length > LARGE_DATASET_LIMIT;
  const renderNodes = useMemo(
    () => (largeDataset ? nodes.slice(0, LARGE_DATASET_LIMIT) : nodes),
    [largeDataset, nodes]
  );

  return (
    <main className="relative h-screen w-full overflow-hidden text-slate-100">
      <div className="pointer-events-none absolute left-4 bottom-4 z-20 rounded-xl border border-cyan-200/30 bg-slate-950/75 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        <p>
          {renderNodes.length.toLocaleString()} nodes
          {bridgesMode ? ' · Bridges mode' : ''}
        </p>
      </div>

      <div className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-cyan-200/30 bg-slate-950/75 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        <Link to="/" className="pointer-events-auto text-cyan-100 hover:text-cyan-50">
          Back to landing
        </Link>
      </div>

      <GalaxyControls
        bridgesMode={bridgesMode}
        onToggleBridges={() => setBridgesMode((value) => !value)}
        onToggleHelp={() => setHelpOpen((value) => !value)}
      />

      <GalaxySidePanel node={selectedNode} onClose={() => setSelectedNode(null)} />

      {hover ? <GalaxyTooltip node={hover.node} x={hover.x} y={hover.y} /> : null}

      <GalaxyHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="w-[min(520px,90vw)] rounded-2xl border border-cyan-200/30 bg-slate-950/75 p-6 text-center backdrop-blur">
            <p className="text-sm text-slate-300">Loading galaxy data…</p>
            <div className="mt-4 h-2 animate-pulse rounded bg-cyan-300/20" />
          </div>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <div className="w-[min(640px,95vw)] rounded-2xl border border-red-300/40 bg-red-900/25 p-5 text-red-100 backdrop-blur">
            <p className="text-sm font-semibold">Failed to load galaxy</p>
            <p className="mt-2 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-4 rounded-lg border border-red-200/50 px-3 py-2 text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !error && renderNodes.length === 0 ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <div className="w-[min(520px,90vw)] rounded-2xl border border-cyan-200/30 bg-slate-950/75 p-6 text-center backdrop-blur">
            <p className="text-lg font-semibold text-cyan-100">No nodes found</p>
            <p className="mt-2 text-sm text-slate-300">Try sample universe data by regenerating `demo/nodes.json`.</p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-4 rounded-lg border border-cyan-200/40 px-3 py-2 text-sm font-semibold text-cyan-100"
            >
              Try sample universe
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !error && renderNodes.length > 0 ? (
        <GalaxyCanvas
          nodes={renderNodes}
          bridgesMode={bridgesMode}
          selectedNodeId={selectedNode?.id ?? null}
          onHoverChange={setHover}
          onNodeClick={setSelectedNode}
        />
      ) : null}

      {largeDataset ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-amber-300/40 bg-amber-900/30 px-3 py-2 text-xs font-semibold text-amber-100">
          Large dataset detected. Rendering first {LARGE_DATASET_LIMIT.toLocaleString()} nodes.
        </div>
      ) : null}
    </main>
  );
}
