import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="w-full">
      <label htmlFor="paper-search" className="sr-only">
        Search paper titles
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-100/70" />
        <input
          id="paper-search"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ask or filter: diffusion models for molecular docking..."
          className="w-full rounded-2xl border border-cyan-200/20 bg-slate-900/70 py-3 pl-11 pr-24 text-sm text-slate-100 shadow-[0_18px_35px_rgba(0,0,0,0.22)] outline-none transition placeholder:text-slate-400 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/25"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-cyan-100/20 bg-slate-800/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-100/65">
          Live
        </span>
      </div>
    </div>
  );
}
