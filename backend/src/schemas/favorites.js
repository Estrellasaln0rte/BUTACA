import { z } from 'zod';

export const mediaTypeSchema = z.enum(['movie', 'tv']);

// Guardamos lo mínimo para pintar la tarjeta sin volver a llamar a TMDB.
export const createFavoriteBody = z
  .object({
    tmdbId: z.number().int().positive(),
    mediaType: mediaTypeSchema,
    title: z.string().trim().min(1).max(200),
    posterPath: z.string().max(200).nullable().optional(),
  })
  .strict();

export const favoriteParams = z.object({
  mediaType: mediaTypeSchema,
  tmdbId: z.coerce.number().int().positive(),
});