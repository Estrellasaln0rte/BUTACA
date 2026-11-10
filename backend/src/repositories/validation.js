import { z } from 'zod';
import { emotionSchema } from '../schemas/emotions.js';
import { createFavoriteBody, mediaTypeSchema } from '../schemas/favorites.js';

// El UUID debe proceder del verificador de Supabase, nunca del body o query.
// Validarlo antes de consultar evita filtros de Prisma con userId undefined.
export const userIdSchema = z.string().uuid();
export const tmdbIdSchema = z.number().int().positive().max(2147483647);

export const favoriteDataSchema = createFavoriteBody.extend({ tmdbId: tmdbIdSchema });
export const favoriteKeySchema = z.object({
  mediaType: mediaTypeSchema,
  tmdbId: z.coerce.number().int().positive().max(2147483647),
}).strict();

const recommendationDataSchema = z.object({
  emotion: emotionSchema,
  mediaType: mediaTypeSchema,
  tmdbId: tmdbIdSchema,
  // Son los géneros de búsqueda usados por la ruta, no géneros inferidos del título.
  genreIds: z.array(tmdbIdSchema).max(100),
}).strict();

export const recommendationBatchSchema = z.array(recommendationDataSchema).max(200);
