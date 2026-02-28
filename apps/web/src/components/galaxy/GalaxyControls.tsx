interface GalaxyControlsProps {
  bridgesMode: boolean;
  onToggleBridges: () => void;
  onToggleHelp: () => void;
}

export function GalaxyControls({ bridgesMode, onToggleBridges, onToggleHelp }: GalaxyControlsProps) {
  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-20 flex items-center gap-2 rounded-2xl border border-cyan-200/30 bg-slate-950/80 p-2 shadow-xl backdrop-blur-xl">
      <button
        type="button"
        onClick={onToggleBridges}
        className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
          bridgesMode
            ? 'border border-cyan-200/60 bg-cyan-300/20 text-cyan-100'
            : 'border border-slate-600/70 bg-slate-900/80 text-slate-200'
        }`}
      >
        Bridges
      </button>
      <button
        type="button"
        onClick={onToggleHelp}
        className="rounded-xl border border-slate-600/70 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200"
      >
        ?
      </button>
    </div>
  );
}
