import { z } from 'zod';

export const GalaxyNodeLayerSchema = z.enum(['dust', 'star', 'bright']);

export const GalaxyNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  authors: z.array(z.string().min(1)).optional(),
  abstract: z.string().optional(),
  year: z.number().int().optional(),
  category: z.string().min(1).optional(),
  cluster: z.number().int(),
  clusterLabel: z.string().min(1).optional(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  size: z.number().positive(),
  sizeBase: z.number().positive().optional(),
  alphaBase: z.number().min(0).max(1).optional(),
  layer: GalaxyNodeLayerSchema.optional(),
  isBridge: z.boolean(),
  url: z.string().optional(),
});

export const RawGalaxyNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  year: z.number().int().optional(),
  category: z.string().min(1).optional(),
  primaryCategory: z.string().min(1).optional(),
  authors: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
  abstract: z.string().optional(),
  summary: z.string().min(1).optional(),
  cluster: z.number().int(),
  clusterLabel: z.string().min(1).optional(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  size: z.number().positive(),
  sizeBase: z.number().positive().optional(),
  alphaBase: z.number().min(0).max(1).optional(),
  layer: GalaxyNodeLayerSchema.optional(),
  isBridge: z.boolean(),
  url: z.string().optional(),
  isAmbient: z.boolean().optional(),
});

export const GalaxyNodesFileSchema = z.array(GalaxyNodeSchema);
export const RawGalaxyNodesFileSchema = z.array(RawGalaxyNodeSchema);

export type GalaxyNode = z.infer<typeof GalaxyNodeSchema>;
export type RawGalaxyNode = z.infer<typeof RawGalaxyNodeSchema>;
