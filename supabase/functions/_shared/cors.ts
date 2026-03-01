import { config } from './config.ts';

function resolveAllowOrigin(request?: Request): string {
  const origin = request?.headers.get('origin');

  if (origin && config.allowedCorsOrigins.includes(origin)) {
    return origin;
  }

  return config.allowedCorsOrigins[0] ?? 'http://localhost:5173';
}

export function corsHeaders(request?: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveAllowOrigin(request),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
  };
}

export function withJson(body: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json',
    },
  });
}

export function handleOptions(request: Request): Response | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }

  const origin = request.headers.get('origin');
  if (origin && !config.allowedCorsOrigins.includes(origin)) {
    return new Response('forbidden', {
      status: 403,
      headers: corsHeaders(request),
    });
  }

  return new Response('ok', { headers: corsHeaders(request) });
}
