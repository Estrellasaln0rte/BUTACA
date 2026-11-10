import { z } from 'zod';
import { mediaTypeSchema } from './favorites.js';
import { pageSchema } from './recommendations.js';

// Query de GET /api/search?query=coco&mediaType=movie&page=1
// Solo navegación: buscar por título no guarda nada en el historial.
export const searchQuery = z.object({
  query: z.string().trim().min(1).max(100),
  mediaType: mediaTypeSchema.default('movie'),
  page: pageSchema,
});
