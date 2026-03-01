import { useEffect, useRef } from 'react';
import type { GalaxyNode } from '../../lib/galaxy/schema';
import { uiTokens } from './uiTokens';

interface PaperCardProps {
  node: GalaxyNode | null;
  open: boolean;
  queued: boolean;
  onClose: () => void;
  onAddToQueue: (node: GalaxyNode) => void;
  onOpenExternal: (url: string) => void;
}

function metaLine(node: GalaxyNode): string {
  const parts: string[] = [];

  if (node.year) {
    parts.push(String(node.year));
  }

  if (node.category) {
    parts.push(node.category);
  }

  if (node.authors && node.authors.length > 0) {
    parts.push(node.authors.length > 1 ? `${node.authors[0]} et al.` : node.authors[0]);
  }

  return parts.join(' · ');
}

const ghostBtnStyle: React.CSSProperties = {
  padding: '5px 14px',
  borderRadius: '8px',
  border: `1px solid ${uiTokens.colors.hairline}`,
  background: 'transparent',
  color: uiTokens.colors.muted,
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '0.02em',
  cursor: 'pointer',
  transition: `all ${uiTokens.transition.fast}`,
};

export function PaperCard({ node, open, queued, onClose, onAddToQueue, onOpenExternal }: PaperCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (cardRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open || !node) {
    return null;
  }

  const meta = metaLine(node);

  return (
    <aside className="pointer-events-none absolute inset-0 z-30">
      <div
        className="pointer-events-auto absolute galaxy-fade-enter"
        ref={cardRef}
        style={{
          bottom: `${uiTokens.spacing.cardMargin}px`,
          right: `${uiTokens.spacing.cardMargin}px`,
          width: '100%',
          maxWidth: '350px',
        }}
      >
        <section
          style={{
            borderRadius: `${uiTokens.radii.lg}px`,
            border: `1px solid ${uiTokens.colors.hairline}`,
            background: uiTokens.colors.cardBg,
            backdropFilter: `blur(${uiTokens.blur.card}px)`,
            WebkitBackdropFilter: `blur(${uiTokens.blur.card}px)`,
            boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
            padding: '18px 20px 16px',
            color: uiTokens.colors.fg,
          }}
        >
          {/* Title – 2 line clamp */}
          <h2
            style={{
              fontSize: '13px',
              fontWeight: 600,
              lineHeight: '1.45',
              margin: 0,
              color: uiTokens.colors.fg,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              letterSpacing: '0.01em',
            }}
          >
            {node.title}
          </h2>

          {/* Meta line */}
          {meta ? (
            <p
              style={{
                fontSize: '11px',
                color: uiTokens.colors.muted2,
                marginTop: '6px',
                marginBottom: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: '1.3',
              }}
            >
              {meta}
            </p>
          ) : null}

          {/* Abstract – 3 line clamp */}
          {node.abstract ? (
            <p
              style={{
                fontSize: '12px',
                color: uiTokens.colors.muted,
                marginTop: '10px',
                marginBottom: 0,
                lineHeight: '1.55',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {node.abstract}
            </p>
          ) : null}

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '14px',
            }}
          >
            {node.url ? (
              <button
                type="button"
                onClick={() => onOpenExternal(node.url as string)}
                style={ghostBtnStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
                  e.currentTarget.style.color = uiTokens.colors.fg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = uiTokens.colors.hairline;
                  e.currentTarget.style.color = uiTokens.colors.muted;
                }}
              >
                Open
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onAddToQueue(node)}
              style={{
                ...ghostBtnStyle,
                opacity: queued ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!queued) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
                  e.currentTarget.style.color = uiTokens.colors.fg;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = uiTokens.colors.hairline;
                e.currentTarget.style.color = uiTokens.colors.muted;
              }}
            >
              {queued ? 'Queued' : 'Add to queue'}
            </button>

            {/* Esc hint */}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.25)',
                letterSpacing: '0.04em',
              }}
            >
              esc
            </span>
          </div>
        </section>
      </div>
    </aside>
  );
}
