import { z } from 'zod';

export const GalaxyNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().optional(),
  cluster: z.number().int(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  size: z.number().positive(),
  isBridge: z.boolean(),
  url: z.string().url().optional(),
});

export const GalaxyNodesFileSchema = z.array(GalaxyNodeSchema);

export type GalaxyNode = z.infer<typeof GalaxyNodeSchema>;
