function requireEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseCsvEnv(name: string, fallback: string[]): string[] {
  const value = Deno.env.get(name);

  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return parsed.length > 0 ? parsed : fallback;
}

export const config = {
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  anthropicApiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
  aiMonthlyCapUsd: Number(Deno.env.get('AI_MONTHLY_CAP_USD') ?? '200'),
  allowedCorsOrigins: parseCsvEnv('ALLOWED_CORS_ORIGINS', ['http://localhost:5173', 'http://127.0.0.1:5173']),
};
