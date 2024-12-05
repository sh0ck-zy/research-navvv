import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupInput } from '../../lib/api/auth';
import { useAuth } from '../../lib/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const RESEARCH_INTERESTS = [
  'Machine Learning',
  'Natural Language Processing',
  'Computer Vision',
  'Robotics',
  'Data Science',
  'Artificial Intelligence',
  'Human-Computer Interaction',
  'Software Engineering'
];

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signup } = useAuth();
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      researchInterests: [],
    },
  });

  const onSubmit = async (data: SignupInput) => {
    try {
      setError(null);
      await signup(data);
      navigate('/');
    } catch (err) {
      setError('Failed to create account. Please try again.');
      console.error('Signup failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Full Name
        </label>
        <input
          {...register('name')}
          type="text"
          id="name"
          autoComplete="name"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          {...register('email')}
          type="email"
          id="email"
          autoComplete="email"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          {...register('password')}
          type="password"
          id="password"
          autoComplete="new-password"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Research Interests
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {RESEARCH_INTERESTS.map((interest) => (
            <label key={interest} className="inline-flex items-center">
              <input
                type="checkbox"
                {...register('researchInterests')}
                value={interest}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">{interest}</span>
            </label>
          ))}
        </div>
        {errors.researchInterests && (
          <p className="mt-1 text-sm text-red-600">{errors.researchInterests.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}