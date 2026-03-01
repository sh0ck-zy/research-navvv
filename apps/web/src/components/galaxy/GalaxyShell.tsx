import { useState } from 'react';
import type { GalaxyNode } from '../../lib/galaxy/schema';
import type { GalaxySearchResult } from '../../lib/galaxy/search';
import { GalaxySearch } from './GalaxySearch';
import { PaperCard } from './PaperCard';
import { uiTokens } from './uiTokens';

interface GalaxyShellProps {
  loading: boolean;
  error: string | null;
  query: string;
  results: GalaxySearchResult[];
  activeIndex: number;
  selectedNode: GalaxyNode | null;
  queued: boolean;
  queueCount: number;
  onRetry: () => void;
  onQueryChange: (value: string) => void;
  onActiveIndexChange: (index: number) => void;
  onSearchSubmit: (nodeId: string) => void;
  onFocusRequest: (focus: () => void) => void;
  onCloseCard: () => void;
  onAddToQueue: (node: GalaxyNode) => void;
  onOpenExternal: (url: string) => void;
}

export function GalaxyShell({
  loading,
  error,
  query,
  results,
  activeIndex,
  selectedNode,
  queued,
  queueCount,
  onRetry,
  onQueryChange,
  onActiveIndexChange,
  onSearchSubmit,
  onFocusRequest,
  onCloseCard,
  onAddToQueue,
  onOpenExternal,
}: GalaxyShellProps) {
  const [queueHover, setQueueHover] = useState(false);
  const showQueue = queueCount > 0 || queueHover;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* Vignette + grain overlays */}
      <div className="galaxy-ui-vignette" />
      <div className="galaxy-ui-grain" />

      {/* Search hero — positioned at ~12% from top */}
      <div
        className="absolute left-1/2 w-[calc(100%-3rem)] -translate-x-1/2"
        style={{ top: uiTokens.spacing.heroTop }}
      >
        <GalaxySearch
          query={query}
          results={results}
          activeIndex={activeIndex}
          onQueryChange={onQueryChange}
          onActiveIndexChange={onActiveIndexChange}
          onSubmit={onSearchSubmit}
          onFocusRequest={onFocusRequest}
        />
      </div>

      {/* Queue indicator — subtle, only visible when queue > 0 or hovered */}
      <div
        className="pointer-events-auto absolute"
        style={{
          bottom: '24px',
          left: '24px',
          padding: '20px',
          margin: '-20px',
        }}
        onMouseEnter={() => setQueueHover(true)}
        onMouseLeave={() => setQueueHover(false)}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: uiTokens.colors.muted2,
            opacity: showQueue ? 0.7 : 0,
            transition: `opacity ${uiTokens.transition.fast}`,
            pointerEvents: 'none',
          }}
        >
          {/* Minimal queue icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M8 12h8M12 8v8" />
          </svg>
          <span>{queueCount}</span>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            style={{
              borderRadius: `${uiTokens.radii.lg}px`,
              border: `1px solid ${uiTokens.colors.hairline}`,
              background: uiTokens.colors.glass,
              backdropFilter: `blur(${uiTokens.blur.shell}px)`,
              WebkitBackdropFilter: `blur(${uiTokens.blur.shell}px)`,
              padding: '10px 20px',
              fontSize: '12px',
              color: uiTokens.colors.muted,
              letterSpacing: '0.02em',
            }}
          >
            Loading…
          </div>
        </div>
      ) : null}

      {/* Error state */}
      {!loading && error ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div
            className="pointer-events-auto"
            style={{
              maxWidth: 'min(520px, 95vw)',
              borderRadius: `${uiTokens.radii.lg}px`,
              border: '1px solid rgba(200,80,80,0.25)',
              background: 'rgba(60,18,24,0.5)',
              backdropFilter: `blur(${uiTokens.blur.card}px)`,
              WebkitBackdropFilter: `blur(${uiTokens.blur.card}px)`,
              padding: '20px 24px',
              color: 'rgba(255,200,200,0.9)',
            }}
          >
            <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
              Could not load galaxy data
            </p>
            <p style={{ fontSize: '12px', marginTop: '8px', marginBottom: 0, opacity: 0.8 }}>
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              style={{
                marginTop: '14px',
                padding: '6px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(200,80,80,0.3)',
                background: 'transparent',
                color: 'rgba(255,200,200,0.9)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: `all ${uiTokens.transition.fast}`,
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {/* Paper detail card */}
      <PaperCard
        node={selectedNode}
        open={Boolean(selectedNode)}
        queued={queued}
        onClose={onCloseCard}
        onAddToQueue={onAddToQueue}
        onOpenExternal={onOpenExternal}
      />
    </div>
  );
}
