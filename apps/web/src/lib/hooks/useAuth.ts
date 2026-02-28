import { useCallback } from 'react';
import type { PilotSignupInput } from '@research-nav/shared-types';
import { supabase } from '../supabase/client';
import { useAuthStore } from '../store/auth';
import type { LoginInput } from '../api/auth';

interface PilotSignupResponse {
  accessToken: string;
  refreshToken: string;
}

export function useAuth() {
  const clear = useAuthStore((state) => state.clear);

  const login = useCallback(async ({ email, password }: LoginInput) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw error;
    }

    return data;
  }, []);

  const signup = useCallback(async (input: PilotSignupInput) => {
    const { data, error } = await supabase.functions.invoke<PilotSignupResponse>('pilot-signup', {
      body: input,
    });

    if (error) {
      throw error;
    }

    if (!data?.accessToken || !data.refreshToken) {
      throw new Error('Signup function did not return a session.');
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    });

    if (sessionError) {
      throw sessionError;
    }

    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } finally {
      clear();
    }
  }, [clear]);

  return {
    login,
    signup,
    logout,
  };
}
