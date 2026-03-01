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
      <section className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200/25 bg-slate-950/92 p-6 text-slate-100 shadow-2xl backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-slate-50">How to read this map</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-200">
          <li>Drag to orbit and scroll to zoom through arXiv domains.</li>
          <li>Color groups represent major research areas.</li>
          <li>Bridge focus isolates papers spanning multiple domains.</li>
          <li>Hover for quick context, click for full paper details.</li>
          <li>Press Esc to clear selection and close this guide.</li>
        </ul>
      </section>
    </div>
  );
}
