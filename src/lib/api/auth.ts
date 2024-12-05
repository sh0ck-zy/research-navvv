import { z } from 'zod';
import { mockUsers } from './mockData';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signupSchema = loginSchema.extend({
  name: z.string().min(2),
  researchInterests: z.array(z.string()),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// Simulated delay to mimic API latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function login(data: LoginInput) {
  await delay(500); // Simulate network delay

  const user = mockUsers.find(u => u.email === data.email && u.password === data.password);
  
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const { password, ...userWithoutPassword } = user;
  
  return {
    user: userWithoutPassword,
    token: 'mock-jwt-token', // In a real app, this would be a real JWT
  };
}

export async function signup(data: SignupInput) {
  await delay(500); // Simulate network delay

  if (mockUsers.some(u => u.email === data.email)) {
    throw new Error('Email already exists');
  }

  const newUser = {
    id: String(mockUsers.length + 1),
    ...data,
  };

  mockUsers.push(newUser);

  const { password, ...userWithoutPassword } = newUser;
  
  return {
    user: userWithoutPassword,
    token: 'mock-jwt-token', // In a real app, this would be a real JWT
  };
}