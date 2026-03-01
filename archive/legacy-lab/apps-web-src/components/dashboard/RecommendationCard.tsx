import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface RecommendationCardProps {
  title: string;
  score: number;
  explanation: string;
  paperId: string;
}

export function RecommendationCard({ title, score, explanation, paperId }: RecommendationCardProps) {
  return (
    <article className="rounded-2xl border border-cyan-200/20 bg-slate-900/65 p-4 shadow-[0_20px_40px_rgba(2,6,23,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <span className="rounded-full border border-cyan-200/35 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-100">
          {Math.round(score)}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-300/85">{explanation}</p>
      <Link
        to={`/lab/papers/${paperId}`}
        className="mt-4 inline-flex items-center text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
      >
        View details
        <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Link>
    </article>
  );
}
