import { z } from 'zod';
import { emotionSchema } from './emotions.js';

// Solo se acepta la etiqueta de emoción (y qué tan segura fue). NUNCA una imagen.
// .strict() rechaza campos extra, así nadie puede colar una foto en base64.
export const createMoodBody = z
  .object({
    emotion: emotionSchema,
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export const listMoodsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});