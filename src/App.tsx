import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/auth/Login';
import { SignupPage } from './pages/auth/Signup';
import { AuthGuard } from './components/layout/AuthGuard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
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
      </Routes>
    </Router>
  );
}

export default App; // This default export is required