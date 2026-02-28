import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/auth/Login';
import { SignupPage } from './pages/auth/Signup';
import { AuthGuard } from './components/layout/AuthGuard';
import { GalaxyBackground } from './components/layout/GalaxyBackground';
import { useAuthStore } from './lib/store/auth';
import { supabase } from './lib/supabase/client';
import { useThemeSync } from './lib/hooks/useThemeSync';
import { PaperDetailPage } from './pages/lab/PaperDetail';

function AuthBootstrap() {
  const setSession = useAuthStore((state) => state.setSession);
  const setInitialized = useAuthStore((state) => state.setInitialized);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setInitialized(true);
    }).catch(() => {
      if (mounted) {
        setInitialized(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setInitialized(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setInitialized, setSession]);

  return null;
}

function RootRedirect() {
  const initialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);

  if (!initialized) {
    return <div className="min-h-screen bg-white/20 dark:bg-black/30" />;
  }

  return <Navigate to={session ? '/lab' : '/login'} replace />;
}

function AppRoutes() {
  const location = useLocation();
  const showGlobalBackground = !location.pathname.startsWith('/lab');

  return (
    <>
      {showGlobalBackground ? <GalaxyBackground /> : null}
      <AuthBootstrap />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/lab"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />
        <Route
          path="/lab/papers/:paperId"
          element={
            <AuthGuard>
              <PaperDetailPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  useThemeSync();

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
