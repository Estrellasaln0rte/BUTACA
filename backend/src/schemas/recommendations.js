import { z } from 'zod';
import { emotionSchema } from './emotions.js';
import { mediaTypeSchema } from './favorites.js';

// Los query params siempre llegan como texto: page se convierte a número con coerce.
// Los params desconocidos se ignoran (no se rechazan), igual que en el resto de queries.
export const pageSchema = z.coerce.number().int().min(1).max(500).default(1); // TMDB no entrega más de 500 páginas

// Query de GET /api/recommendations?emotion=sad&mediaType=movie&page=1&history=false
// history: si la consulta queda en el historial del tablero. Por defecto sí; el front manda
// "false" cuando solo se explora (otro ánimo, otra pestaña, "Ver más").
export const recommendationsQuery = z.object({
  emotion: emotionSchema,
  mediaType: mediaTypeSchema.default('movie'),
  page: pageSchema,
  history: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(true),
});
