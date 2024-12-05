import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '../../lib/api/auth';
import { useAuth } from '../../lib/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Input } from '../ui/Input';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'demo@example.com', // Pre-fill for demo purposes
      password: 'password123',
    },
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      setError(null);
      await login(data); // Login API call should set the token in the store
      navigate('/lab'); // Navigate to the lab page after successful login
    } catch (err) {
      setError('Invalid email or password');
      console.error('Login failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <Input
        {...register('email')}
        type="email"
        label="Email"
        error={errors.email?.message}
        autoComplete="email"
      />

      <Input
        {...register('password')}
        type="password"
        label="Password"
        error={errors.password?.message}
        autoComplete="current-password"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
