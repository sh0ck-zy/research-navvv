import { useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { login as loginApi, signup as signupApi } from '../api/auth';
import type { LoginInput, SignupInput } from '../api/auth';

export function useAuth() {
  const { setUser, setToken, logout: logoutStore } = useAuthStore();

  const login = useCallback(
    async (data: LoginInput) => {
      try {
        console.log('Logging in with data:', data); // Debugging input
        const response = await loginApi(data);

        // Debugging response
        console.log('Login API response:', response);

        // Update auth state
        setUser(response.user);
        setToken(response.token);

        // Debugging state update
        console.log('User set:', response.user);
        console.log('Token set:', response.token);

        return response;
      } catch (error) {
        console.error('Login error:', error); // Log the error for debugging
        throw error;
      }
    },
    [setUser, setToken]
  );

  const signup = useCallback(
    async (data: SignupInput) => {
      try {
        console.log('Signing up with data:', data); // Debugging input
        const response = await signupApi(data);

        // Debugging response
        console.log('Signup API response:', response);

        // Update auth state
        setUser(response.user);
        setToken(response.token);

        // Debugging state update
        console.log('User set after signup:', response.user);
        console.log('Token set after signup:', response.token);

        return response;
      } catch (error) {
        console.error('Signup error:', error); // Log the error for debugging
        throw error;
      }
    },
    [setUser, setToken]
  );

  const logout = useCallback(() => {
    console.log('Logging out...'); // Debugging
    logoutStore();
    console.log('User and token cleared from state'); // Confirm state reset
  }, [logoutStore]);

  return {
    login,
    signup,
    logout,
  };
}
