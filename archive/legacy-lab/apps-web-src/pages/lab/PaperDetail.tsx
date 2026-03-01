import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { getPaperDetail, savePaperCorrection } from '../../lib/api/pilot';
import type { PaperDetailDTO } from '@research-nav/shared-types';
import { isSupabaseConfigured } from '../../lib/supabase/client';

function FieldEditor({
  label,
  value,
  onSave,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</label>
      {multiline ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-blue-900"
        />
      ) : (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-blue-900"
        />
      )}
      <button
        onClick={() => onSave(draft)}
        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        <Save className="mr-1 h-3.5 w-3.5" />
        Save
      </button>
    </div>
  );
}

function formatConfidence(detail: PaperDetailDTO): string {
  if (detail.confidence === null || Number.isNaN(detail.confidence)) {
    return 'N/A';
  }

  return `${Math.round(detail.confidence * 100)}%`;
}

export function PaperDetailPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const demoTitle = ((location.state ?? {}) as { demoTitle?: string }).demoTitle ?? 'Selected paper';

  const detailQuery = useQuery({
    queryKey: ['paper-detail', paperId],
    queryFn: () => getPaperDetail(paperId ?? ''),
    enabled: Boolean(paperId && isSupabaseConfigured),
  });

  const saveMutation = useMutation({
    mutationFn: savePaperCorrection,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['paper-detail', paperId] }),
        queryClient.invalidateQueries({ queryKey: ['papers'] }),
        queryClient.invalidateQueries({ queryKey: ['graph'] }),
        queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
      ]);
    },
  });

  const detail = detailQuery.data;

  const sortedEntities = useMemo(
    () => [...(detail?.entities ?? [])].sort((a, b) => b.confidence - a.confidence),
    [detail?.entities]
  );

  if (!paperId) {
    return <Navigate to="/lab" replace />;
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="flex items-center justify-between">
            <Link to="/lab" className="inline-flex items-center text-sm font-medium text-cyan-300 hover:text-cyan-200">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to galaxy
            </Link>
            <span className="rounded-full border border-cyan-200/20 bg-slate-900/65 px-3 py-1 text-xs font-medium text-cyan-100">
              Demo paper workspace
            </span>
          </div>

          <section className="grid gap-4 rounded-2xl border border-cyan-200/15 bg-slate-900/55 p-5 md:grid-cols-[2fr,1fr]">
            <div className="rounded-2xl border border-cyan-200/15 bg-slate-950/70 p-4">
              <h1 className="text-lg font-semibold text-slate-50">{demoTitle}</h1>
              <p className="mt-2 text-sm text-slate-300/80">
                This is a demo viewer shell. When ArXiv/OpenAlex ingestion is connected, this panel renders the source PDF and in-document AI tools.
              </p>
              <div className="mt-4 flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-cyan-200/20 bg-slate-950/50 text-sm text-slate-400">
                PDF canvas placeholder
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-cyan-200/15 bg-slate-950/55 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100/80">Research tools</h2>
              <p className="text-sm text-slate-300/85">- Annotate claims and export notes</p>
              <p className="text-sm text-slate-300/85">- Ask agents over paper sections</p>
              <p className="text-sm text-slate-300/85">- Link entities to your graph memory</p>
              <p className="text-sm text-slate-300/85">- Generate related-paper trails</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white/55 px-4 py-6 text-gray-900 backdrop-blur-[0.5px] dark:bg-slate-950/50 dark:text-white">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/lab"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to lab
          </Link>
          {detail ? (
            <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {detail.status} · {detail.processingStage}
            </span>
          ) : null}
        </div>

        {detailQuery.isLoading ? (
          <p className="text-sm text-gray-500">Loading paper details...</p>
        ) : null}

        {detailQuery.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            Failed to load paper details.
          </div>
        ) : null}

        {detail ? (
          <>
            <section className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-2">
              <FieldEditor
                label="Title"
                value={detail.title}
                onSave={(newValue) =>
                  saveMutation.mutateAsync({
                    paperId,
                    field: 'title',
                    newValue,
                  })
                }
              />
              <FieldEditor
                label="Year"
                value={detail.year ? String(detail.year) : ''}
                onSave={(newValue) =>
                  saveMutation.mutateAsync({
                    paperId,
                    field: 'year',
                    newValue,
                  })
                }
              />
              <FieldEditor
                label="Abstract"
                value={detail.abstract ?? ''}
                multiline
                onSave={(newValue) =>
                  saveMutation.mutateAsync({
                    paperId,
                    field: 'abstract',
                    newValue,
                  })
                }
              />
              <FieldEditor
                label="Summary"
                value={detail.summary ?? ''}
                multiline
                onSave={(newValue) =>
                  saveMutation.mutateAsync({
                    paperId,
                    field: 'summary',
                    newValue,
                  })
                }
              />
              <div className="rounded-xl bg-gray-100 p-4 text-sm dark:bg-gray-800">
                <p>
                  <span className="font-semibold">Confidence:</span> {formatConfidence(detail)}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">Venue:</span> {detail.venue ?? 'Unknown'}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">Pages:</span> {detail.pageCount ?? 'Unknown'}
                </p>
              </div>
              {saveMutation.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  Save failed: {saveMutation.error instanceof Error ? saveMutation.error.message : 'Unknown error'}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-lg font-semibold">Extracted Entities</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {sortedEntities.map((entity) => (
                  <span
                    key={entity.id}
                    className="rounded-full border border-gray-300 px-3 py-1 text-xs dark:border-gray-700"
                    title={`confidence: ${Math.round(entity.confidence * 100)}% · source: ${entity.source}`}
                  >
                    {entity.type}: {entity.canonicalName}
                  </span>
                ))}
                {sortedEntities.length === 0 ? (
                  <p className="text-sm text-gray-500">No entities extracted yet.</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-lg font-semibold">Citations</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
                {detail.citations.map((citation: string) => (
                  <li key={citation}>{citation}</li>
                ))}
              </ul>
              {detail.citations.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No citations available yet.</p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
