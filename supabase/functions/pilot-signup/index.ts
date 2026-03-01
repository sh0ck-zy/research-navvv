import { z } from 'https://esm.sh/zod@3.23.8';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { handleOptions, withJson } from '../_shared/cors.ts';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  researchInterests: z.array(z.string()).default([]),
});

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);

  if (optionsResponse) {
    return optionsResponse;
  }

  try {
    const payload = signupSchema.parse(await request.json());
    const email = payload.email.toLowerCase().trim();

    const service = createServiceClient();
    const anon = createAnonClient();

    const { data: allowlistRow, error: allowlistError } = await service
      .from('allowed_emails')
      .select('email, status')
      .eq('email', email)
      .single();

    if (allowlistError || !allowlistRow || allowlistRow.status !== 'invited') {
      return withJson({ error: 'This email is not invited for the pilot.' }, 403, request);
    }

    const { data: createdUser, error: createError } = await service.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        name: payload.name,
      },
    });

    if (createError || !createdUser.user?.id) {
      return withJson({ error: createError?.message ?? 'Failed to create user.' }, 400, request);
    }

    const userId = createdUser.user.id;

    const { error: profileError } = await service.from('profiles').upsert(
      {
        id: userId,
        email,
        name: payload.name,
        research_interests: payload.researchInterests,
      },
      {
        onConflict: 'id',
      }
    );

    if (profileError) {
      return withJson({ error: profileError.message }, 500, request);
    }

    await service
      .from('allowed_emails')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('email', email);

    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password: payload.password,
    });

    if (signInError || !signInData.session) {
      return withJson({ error: signInError?.message ?? 'Signup succeeded but sign-in failed.' }, 500, request);
    }

    return withJson(
      {
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
      },
      200,
      request
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return withJson({ error: message }, 500, request);
  }
});
