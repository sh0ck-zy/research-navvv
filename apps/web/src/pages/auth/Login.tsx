import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LoginForm } from '../../components/auth/LoginForm';
import { useAuthStore } from '../../lib/store/auth';
import { isDevAuthEnabled, isSupabaseConfigured } from '../../lib/supabase/client';
import { createDevSession, DEV_LOGIN_EMAIL, DEV_LOGIN_PASSWORD } from '../../lib/devAuth';
import { Input } from '../../components/ui/Input';

export function LoginPage() {
  const navigate = useNavigate();
  const initialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);
  const setInitialized = useAuthStore((state) => state.setInitialized);

  const [devEmail, setDevEmail] = useState(DEV_LOGIN_EMAIL);
  const [devPassword, setDevPassword] = useState(DEV_LOGIN_PASSWORD);
  const [devError, setDevError] = useState<string | null>(null);

  if (initialized && session) {
    return <Navigate to="/galaxy" replace />;
  }

  const handleDevLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setDevError(null);
    if (devPassword !== DEV_LOGIN_PASSWORD) {
      setDevError('Use the dev password from .env.example (default: password).');
      return;
    }
    setSession(createDevSession(devEmail));
    setInitialized(true);
    navigate('/galaxy', { replace: true });
  };

  const showDevLogin = !isSupabaseConfigured && isDevAuthEnabled;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white/20 px-4 py-12 dark:bg-black/35">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-white">Research Navigator</h1>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">Sign in to continue to the pilot lab.</p>
        <div className="mt-8">
          <LoginForm />
        </div>
        {showDevLogin && (
          <>
            <div className="my-6 border-t border-gray-200 dark:border-gray-700" />
            <p className="text-center text-sm font-medium text-gray-700 dark:text-gray-200">Dev login (no Supabase)</p>
            <form onSubmit={handleDevLogin} className="mt-3 space-y-3">
              {devError && (
                <div className="rounded-md bg-amber-50 p-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  {devError}
                </div>
              )}
              <Input
                id="dev-email"
                type="email"
                label="Email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
              />
              <Input
                id="dev-password"
                type="password"
                label="Password"
                value={devPassword}
                onChange={(e) => setDevPassword(e.target.value)}
              />
              <button
                type="submit"
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Enter as dev
              </button>
            </form>
          </>
        )}
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Need access?{' '}
          <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-500">
            Request signup
          </Link>
        </p>
      </div>
    </div>
  );
}
