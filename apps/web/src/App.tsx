import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useThemeSync } from './lib/hooks/useThemeSync';
import { GalaxyPage } from './pages/Galaxy';
import { LoginPage } from './pages/auth/Login';
import { SignupPage } from './pages/auth/Signup';

function AppShell() {
  return (
    <>
      {/* Removed GalaxyBackground to keep design perfectly matte and unpolluted */}

      <Routes>
        <Route path="/" element={<GalaxyPage />} />
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
