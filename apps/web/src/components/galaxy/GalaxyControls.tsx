interface GalaxyControlsProps {
  bridgesMode: boolean;
  onToggleBridges: () => void;
  onToggleHelp: () => void;
}

export function GalaxyControls({ bridgesMode, onToggleBridges, onToggleHelp }: GalaxyControlsProps) {
  return (
    <div className="pointer-events-auto absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-6">
      <button
        type="button"
        onClick={onToggleBridges}
        className={`text-[11px] uppercase tracking-[0.15em] transition-colors ${bridgesMode
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-300'
          }`}
      >
        Bridge focus
      </button>
      <button
        type="button"
        onClick={onToggleHelp}
        className="text-[11px] uppercase tracking-[0.15em] text-slate-500 hover:text-slate-300 transition-colors"
      >
        Guide
      </button>
    </div>
  );
}
