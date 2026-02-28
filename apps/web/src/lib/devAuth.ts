import type { Session } from '@supabase/supabase-js';

/**
 * Creates a minimal Session-like object for dev login when Supabase is not configured.
 * Lets you enter the app and use the UI; API calls will fail until Supabase is set up.
 */
export function createDevSession(email: string): Session {
  return {
    access_token: 'dev-access-token',
    refresh_token: 'dev-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    expires_in: 86400,
    token_type: 'bearer',
    user: {
      id: 'dev-user-id',
      email: email,
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
    },
  } as Session;
}

export const DEV_LOGIN_EMAIL = 'dev@localhost';
export const DEV_LOGIN_PASSWORD = 'password';
