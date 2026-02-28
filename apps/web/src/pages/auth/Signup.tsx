import { Link, Navigate } from 'react-router-dom';
import { SignupForm } from '../../components/auth/SignupForm';
import { useAuthStore } from '../../lib/store/auth';

export function SignupPage() {
  const initialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);

  if (initialized && session) {
    return <Navigate to="/lab" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white/20 px-4 py-12 dark:bg-black/35">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-white">Pilot Signup</h1>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">Only allowlisted emails can register for this pilot.</p>
        <div className="mt-8">
          <SignupForm />
        </div>
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
