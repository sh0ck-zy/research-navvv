import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { signupSchema, type SignupInput } from '../../lib/api/auth';
import { useAuth } from '../../lib/hooks/useAuth';
import { Input } from '../ui/Input';

const RESEARCH_INTERESTS = [
  'Machine Learning',
  'Natural Language Processing',
  'Computer Vision',
  'Robotics',
  'Data Science',
  'Artificial Intelligence',
  'Human-Computer Interaction',
  'Software Engineering',
] as const;

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signup } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      researchInterests: [],
    },
  });

  const onSubmit = async (data: SignupInput) => {
    try {
      setError(null);
      await signup(data);
      navigate('/lab', { replace: true });
    } catch (signupError) {
      const fallback = 'Signup failed. You may need to be invited to this pilot.';
      const message = signupError instanceof Error && signupError.message ? signupError.message : fallback;
      setError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <Input id="name" type="text" label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />

      <Input id="email" type="email" label="Email" autoComplete="email" error={errors.email?.message} {...register('email')} />

      <Input
        id="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Research interests</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RESEARCH_INTERESTS.map((interest) => (
            <label key={interest} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                value={interest}
                {...register('researchInterests')}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {interest}
            </label>
          ))}
        </div>
        {errors.researchInterests ? (
          <p className="mt-1 text-sm text-red-600">{errors.researchInterests.message}</p>
        ) : null}
      </fieldset>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        Signup is invite-only during pilot. Use your allowlisted email.
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}
