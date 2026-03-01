import { useEffect, useMemo, useRef, useState } from 'react';
import type { GalaxySearchResult } from '../../lib/galaxy/search';
import { uiTokens } from './uiTokens';

interface GalaxySearchProps {
  query: string;
  results: GalaxySearchResult[];
  activeIndex: number;
  onQueryChange: (value: string) => void;
  onActiveIndexChange: (index: number) => void;
  onSubmit: (nodeId: string) => void;
  onFocusRequest: (focus: () => void) => void;
}

function clampIndex(index: number, max: number) {
  if (max < 0) {
    return -1;
  }

  if (index < 0) {
    return 0;
  }

  if (index > max) {
    return max;
  }

  return index;
}

/** Build a compact meta string: year · category · first author */
function resultMeta(node: GalaxySearchResult['node']): string {
  const parts: string[] = [];
  if (node.year) parts.push(String(node.year));
  if (node.category) parts.push(node.category);
  if (node.authors && node.authors.length > 0) {
    parts.push(node.authors.length > 1 ? `${node.authors[0]} et al.` : node.authors[0]);
  }
  return parts.join(' · ');
}

export function GalaxySearch({
  query,
  results,
  activeIndex,
  onQueryChange,
  onActiveIndexChange,
  onSubmit,
  onFocusRequest,
}: GalaxySearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const open = isFocused && query.trim().length > 0 && results.length > 0;

  useEffect(() => {
    onFocusRequest(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [onFocusRequest]);

  useEffect(() => {
    const maxIndex = results.length - 1;
    if (maxIndex < 0) {
      onActiveIndexChange(-1);
      return;
    }

    if (activeIndex > maxIndex) {
      onActiveIndexChange(maxIndex);
    }
  }, [activeIndex, onActiveIndexChange, results.length]);

  const placeholder = useMemo(() => 'Search papers, authors, topics…', []);

  const handleSubmit = (index: number) => {
    const nextIndex = clampIndex(index, results.length - 1);
    if (nextIndex < 0) {
      return;
    }

    const hit = results[nextIndex];
    onSubmit(hit.node.id);
    setIsFocused(false);
  };

  return (
    <div className="pointer-events-auto mx-auto w-full" style={{ maxWidth: `${uiTokens.search.maxWidth}px` }}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            if (activeIndex !== -1) {
              onActiveIndexChange(0);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 120);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              onActiveIndexChange(clampIndex(activeIndex + 1, results.length - 1));
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              onActiveIndexChange(clampIndex(activeIndex - 1, results.length - 1));
              return;
            }

            if (event.key === 'Enter') {
              event.preventDefault();
              handleSubmit(activeIndex >= 0 ? activeIndex : 0);
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              onQueryChange('');
              onActiveIndexChange(-1);
              inputRef.current?.blur();
            }
          }}
          placeholder={placeholder}
          className="w-full outline-none"
          style={{
            height: `${uiTokens.search.height}px`,
            borderRadius: `${uiTokens.radii.lg}px`,
            backdropFilter: `blur(${uiTokens.blur.search}px)`,
            WebkitBackdropFilter: `blur(${uiTokens.blur.search}px)`,
            background: uiTokens.colors.searchBg,
            color: uiTokens.colors.searchText,
            border: `1px solid ${uiTokens.colors.hairline}`,
            padding: '0 24px',
            fontSize: '15px',
            fontWeight: 500,
            letterSpacing: '0.01em',
            boxShadow: isFocused
              ? `0 0 0 3px ${uiTokens.colors.accentGlow}, 0 20px 50px rgba(0,0,0,0.35)`
              : '0 20px 50px rgba(0,0,0,0.35)',
            transition: `box-shadow ${uiTokens.transition.fast}, border-color ${uiTokens.transition.fast}`,
          }}
          aria-label="Search papers"
        />

        {open ? (
          <div
            className="absolute left-0 right-0 galaxy-fade-enter"
            style={{
              top: 'calc(100% + 8px)',
              borderRadius: `${uiTokens.radii.lg}px`,
              backdropFilter: `blur(${uiTokens.blur.card}px)`,
              WebkitBackdropFilter: `blur(${uiTokens.blur.card}px)`,
              background: uiTokens.colors.dropdownBg,
              border: `1px solid ${uiTokens.colors.hairline}`,
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            <ul style={{ maxHeight: '340px', overflowY: 'auto', padding: '6px 0' }}>
              {results.slice(0, uiTokens.search.dropdownMax).map((result, index) => {
                const active = index === activeIndex;
                const meta = resultMeta(result.node);

                return (
                  <li key={result.node.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => onActiveIndexChange(index)}
                      onClick={() => handleSubmit(index)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 18px',
                        border: 'none',
                        cursor: 'pointer',
                        background: active ? uiTokens.colors.rowActive : 'transparent',
                        transition: `background ${uiTokens.transition.fast}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: active ? uiTokens.colors.fg : 'rgba(255,255,255,0.85)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: '1.4',
                        }}
                      >
                        {result.node.title}
                      </div>
                      {meta ? (
                        <div
                          style={{
                            fontSize: '11px',
                            color: uiTokens.colors.muted2,
                            marginTop: '2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: '1.3',
                          }}
                        >
                          {meta}
                        </div>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
