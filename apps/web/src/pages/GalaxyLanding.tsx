import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GalaxyCanvas, type FlyToRequest } from '../components/galaxy/GalaxyCanvas';
import { GalaxyShell } from '../components/galaxy/GalaxyShell';
import { loadGalaxyNodes } from '../lib/galaxy/loadNodes';
import { createGalaxySearchIndex, searchGalaxyNodes } from '../lib/galaxy/search';
import type { GalaxyNode } from '../lib/galaxy/schema';
import { useQueueStore } from '../lib/store/queue';

const LARGE_DATASET_LIMIT = 20_000;
const SEARCH_DEBOUNCE_MS = 90;

export function GalaxyLandingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GalaxyNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<GalaxyNode | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [reloadKey, setReloadKey] = useState(0);
  const [flyToRequest, setFlyToRequest] = useState<FlyToRequest | null>(null);
  const nonceRef = useRef(0);
  const searchFocusRef = useRef<(() => void) | null>(null);
  const lastSearchSubmitAtRef = useRef(0);

  const queueItems = useQueueStore((state) => state.items);
  const addNodeToQueue = useQueueStore((state) => state.addNode);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    const result = await loadGalaxyNodes(signal);

    if (result.status === 'error') {
      setNodes([]);
      setError(result.message);
      setLoading(false);
      return;
    }

    setNodes(result.nodes);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, reloadKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const targetTag = target instanceof HTMLElement ? target.tagName.toLowerCase() : '';
      const editable =
        target instanceof HTMLElement &&
        (target.isContentEditable || targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select');

      if (event.key === '/' && !editable) {
        event.preventDefault();
        searchFocusRef.current?.();
        return;
      }

      if (event.key === 'Escape') {
        if (query.length > 0) {
          setQuery('');
          setActiveIndex(-1);
          return;
        }

        setSelectedNode(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [query.length]);

  const renderNodes = useMemo(
    () => (nodes.length > LARGE_DATASET_LIMIT ? nodes.slice(0, LARGE_DATASET_LIMIT) : nodes),
    [nodes]
  );

  const searchIndex = useMemo(() => createGalaxySearchIndex(renderNodes), [renderNodes]);
  const searchResults = useMemo(() => searchGalaxyNodes(searchIndex, query, 6), [query, searchIndex]);

  useEffect(() => {
    if (searchResults.length === 0) {
      setActiveIndex(-1);
      return;
    }

    if (activeIndex === -1) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex >= searchResults.length) {
      setActiveIndex(searchResults.length - 1);
    }
  }, [activeIndex, searchResults]);

  const queueCount = queueItems.length;
  const selectedQueued = selectedNode ? queueItems.some((item) => item.id === selectedNode.id) : false;

  const requestFlyToNode = useCallback((nodeId: string, source: 'search' | 'ui') => {
    const now = performance.now();
    if (source === 'search' && now - lastSearchSubmitAtRef.current < SEARCH_DEBOUNCE_MS) {
      return;
    }

    lastSearchSubmitAtRef.current = now;
    nonceRef.current += 1;
    setFlyToRequest({ nodeId, nonce: nonceRef.current, source });
  }, []);

  const onSearchSubmit = useCallback(
    (nodeId: string) => {
      const hit = renderNodes.find((node) => node.id === nodeId);
      if (!hit) {
        return;
      }

      setQuery(hit.title);
      setActiveIndex(-1);
      requestFlyToNode(nodeId, 'search');
    },
    [renderNodes, requestFlyToNode]
  );

  const onFlyToComplete = useCallback(
    (nodeId: string) => {
      const node = renderNodes.find((item) => item.id === nodeId) ?? null;
      setSelectedNode(node);
    },
    [renderNodes]
  );

  return (
    <main className="relative h-screen w-full overflow-hidden text-slate-100">
      {!loading && !error && renderNodes.length > 0 ? (
        <GalaxyCanvas
          nodes={renderNodes}
          bridgesMode={false}
          selectedNodeId={selectedNode?.id ?? null}
          pointThreshold={3.4}
          flyToRequest={flyToRequest}
          onFlyToComplete={onFlyToComplete}
          onHoverChange={() => undefined}
          onNodeClick={setSelectedNode}
        />
      ) : (
        <div className="absolute inset-0" />
      )}

      <GalaxyShell
        loading={loading}
        error={error}
        query={query}
        results={searchResults}
        activeIndex={activeIndex}
        selectedNode={selectedNode}
        queued={selectedQueued}
        queueCount={queueCount}
        onRetry={() => setReloadKey((value) => value + 1)}
        onQueryChange={setQuery}
        onActiveIndexChange={setActiveIndex}
        onSearchSubmit={onSearchSubmit}
        onFocusRequest={(focus) => {
          searchFocusRef.current = focus;
        }}
        onCloseCard={() => setSelectedNode(null)}
        onAddToQueue={addNodeToQueue}
        onOpenExternal={(url) => {
          window.open(url, '_blank', 'noopener,noreferrer');
        }}
      />
    </main>
  );
}
