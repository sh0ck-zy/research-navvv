import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-16 text-slate-100">
      <section className="w-full max-w-2xl rounded-3xl border border-cyan-200/30 bg-slate-950/65 p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Navvv Galaxy</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">Navigate your research universe</h1>
        <p className="mt-4 text-base text-slate-300">
          Explore a living sample universe now. Import workflows can connect later without changing this core path.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/galaxy"
            className="inline-flex items-center rounded-xl border border-cyan-200/60 bg-cyan-300/20 px-4 py-2 text-sm font-semibold text-cyan-100"
          >
            Explore sample universe
          </Link>
          <button
            type="button"
            className="inline-flex items-center rounded-xl border border-slate-600/70 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Import your library
          </button>
        </div>
      </section>
    </main>
  );
}
