import { LogOut, Moon, Orbit, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../lib/hooks/useTheme';
import { useAuth } from '../../lib/hooks/useAuth';

export function TopBar() {
  const navigate = useNavigate();
  const theme = useTheme((state) => state.theme);
  const toggleTheme = useTheme((state) => state.toggleTheme);
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-cyan-200/10 bg-slate-950/55 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200/30 bg-cyan-300/15 text-cyan-100 shadow-[0_0_30px_rgba(56,189,248,0.25)]">
            <Orbit className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Navvv</p>
            <p className="text-sm font-semibold text-slate-100">Research Galaxy</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="rounded-xl border border-cyan-200/20 bg-slate-900/65 p-2 text-slate-200 transition hover:border-cyan-200/40 hover:text-cyan-100"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            onClick={handleLogout}
            className="rounded-xl border border-red-200/20 bg-red-950/35 p-2 text-red-100 transition hover:border-red-200/40 hover:bg-red-900/55"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
