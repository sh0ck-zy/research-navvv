import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, Loader2, X } from 'lucide-react';
import { getPaperDetail } from '../../lib/api/pilot';
import { isSupabaseConfigured } from '../../lib/supabase/client';

interface SelectedPaper {
  paperId: string;
  title: string;
}

interface PaperOverlayProps {
  paper: SelectedPaper | null;
  onClose: () => void;
}

function truncate(text: string, max = 360) {
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max).trim()}...`;
}

export function PaperOverlay({ paper, onClose }: PaperOverlayProps) {
  useEffect(() => {
    if (!paper) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, paper]);

  const detailQuery = useQuery({
    queryKey: ['paper-overlay', paper?.paperId],
    queryFn: () => getPaperDetail(paper?.paperId ?? ''),
    enabled: Boolean(paper?.paperId && isSupabaseConfigured),
  });

  if (!paper) {
    return null;
  }

  const detail = detailQuery.data;
  const overlayTitle = detail?.title || paper.title;

  return (
    <div className="absolute inset-0 z-40">
      <button
        className="absolute inset-0 h-full w-full bg-slate-950/72 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close paper overlay"
      />

      <section className="absolute inset-x-3 bottom-3 top-16 overflow-hidden rounded-3xl border border-cyan-200/20 bg-slate-950/88 shadow-[0_30px_80px_rgba(3,8,20,0.75)] backdrop-blur-2xl md:inset-x-6 md:top-20">
        <header className="flex items-center justify-between border-b border-cyan-200/15 px-4 py-3 md:px-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/75">Paper Workspace</p>
            <h2 className="max-w-[72vw] truncate text-sm font-semibold text-slate-50 md:text-base">{overlayTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200/25 bg-slate-900/70 text-slate-200 transition hover:border-cyan-200/45 hover:text-cyan-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid h-[calc(100%-61px)] gap-0 md:grid-cols-[2.3fr,1fr]">
          <div className="border-b border-cyan-200/10 p-4 md:border-b-0 md:border-r md:p-6">
            <div className="mb-4 flex items-center gap-2 text-xs text-slate-300/80">
              <FileText className="h-4 w-4 text-cyan-200" />
              {isSupabaseConfigured ? 'Source document and extracted content' : 'Demo source viewer'}
            </div>

            {isSupabaseConfigured && detailQuery.isLoading ? (
              <div className="flex h-[70%] min-h-[320px] items-center justify-center rounded-2xl border border-cyan-200/15 bg-slate-900/55 text-sm text-slate-300">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading paper details...
              </div>
            ) : null}

            {isSupabaseConfigured && detail ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-cyan-200/15 bg-slate-900/45 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">Abstract</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200/90">{detail.abstract || 'No abstract available.'}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-slate-900/45 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">Summary</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200/90">{detail.summary || 'No summary available.'}</p>
                </div>
              </div>
            ) : null}

            {!isSupabaseConfigured ? (
              <div className="space-y-4">
                <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-cyan-200/20 bg-slate-900/45 text-sm text-slate-400">
                  PDF viewer placeholder (overlay mode)
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-slate-900/45 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">Demo notes</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                    This opens on top of the galaxy by design. When your ingestion pipeline is connected, this area will render full paper content,
                    section navigation, notes, and agent actions.
                  </p>
                </div>
              </div>
            ) : null}

            {isSupabaseConfigured && detailQuery.error ? (
              <div className="rounded-2xl border border-red-300/35 bg-red-500/10 p-4 text-sm text-red-100">
                Failed to load paper details. Try another paper or refresh.
              </div>
            ) : null}
          </div>

          <aside className="overflow-y-auto p-4 md:p-6">
            <div className="space-y-3">
              <article className="rounded-2xl border border-cyan-200/15 bg-slate-900/55 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">Status</p>
                <p className="mt-2 text-sm text-slate-100">
                  {detail ? `${detail.status} · ${detail.processingStage}` : 'Demo mode'}
                </p>
              </article>

              <article className="rounded-2xl border border-cyan-200/15 bg-slate-900/55 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">Entities</p>
                <p className="mt-2 text-sm text-slate-200/90">
                  {detail && detail.entities.length > 0
                    ? `${detail.entities.length} extracted entities`
                    : 'Entities will appear here when extraction is available.'}
                </p>
              </article>

              <article className="rounded-2xl border border-cyan-200/15 bg-slate-900/55 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">Quick insight</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                  {detail?.summary
                    ? truncate(detail.summary)
                    : 'Open this panel to keep context while exploring nearby papers in the galaxy.'}
                </p>
              </article>

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/25 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/45 hover:bg-slate-900"
                type="button"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Future: open original PDF source
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
