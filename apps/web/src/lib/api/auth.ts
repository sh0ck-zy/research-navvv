import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signupSchema = loginSchema.extend({
  name: z.string().min(2),
  researchInterests: z.array(z.string()).min(1, 'Pick at least one research interest'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
