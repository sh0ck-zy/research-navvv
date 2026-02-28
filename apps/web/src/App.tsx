import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GalaxyBackground } from './components/layout/GalaxyBackground';
import { useThemeSync } from './lib/hooks/useThemeSync';
import { LandingPage } from './pages/Landing';
import { GalaxyPage } from './pages/Galaxy';
import { LoginPage } from './pages/auth/Login';
import { SignupPage } from './pages/auth/Signup';

function App() {
  useThemeSync();

  return (
    <BrowserRouter>
      <GalaxyBackground />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/galaxy" element={<GalaxyPage />} />
        <Route path="/lab" element={<Navigate to="/galaxy" replace />} />
        <Route path="/lab/papers/:paperId" element={<Navigate to="/galaxy" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
