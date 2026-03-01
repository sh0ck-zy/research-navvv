import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { GalaxyBackground } from './components/layout/GalaxyBackground';
import { useThemeSync } from './lib/hooks/useThemeSync';
import { LandingPage } from './pages/Landing';
import { GalaxyPage } from './pages/Galaxy';
import { LoginPage } from './pages/auth/Login';
import { SignupPage } from './pages/auth/Signup';

function AppShell() {
  const location = useLocation();
  const showBackground = !location.pathname.startsWith('/galaxy');

  return (
    <>
      {showBackground ? <GalaxyBackground /> : null}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/galaxy" element={<GalaxyPage />} />
        <Route path="/lab" element={<Navigate to="/galaxy" replace />} />
        <Route path="/lab/papers/:paperId" element={<Navigate to="/galaxy" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  useThemeSync();

  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
