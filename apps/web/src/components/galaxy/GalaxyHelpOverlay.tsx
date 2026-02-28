interface GalaxyHelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function GalaxyHelpOverlay({ open, onClose }: GalaxyHelpOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40">
      <button
        className="absolute inset-0 h-full w-full bg-slate-950/70"
        onClick={onClose}
        aria-label="Close help overlay"
      />
      <section className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-200/35 bg-slate-950/92 p-5 text-slate-100 shadow-2xl backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-cyan-100">Galaxy controls</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-200">
          <li>Drag: orbit/pan camera</li>
          <li>Scroll: zoom</li>
          <li>Hover: inspect title quickly</li>
          <li>Click: open side panel</li>
          <li>Bridges: dim non-bridge nodes and highlight bridges</li>
          <li>Esc: close panel/help</li>
          <li>?: toggle this help</li>
        </ul>
      </section>
    </div>
  );
}
