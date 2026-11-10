import { describe, it, expect } from 'vitest';
import { createMoodBody } from '../../src/schemas/moods.js';
import { createFavoriteBody, favoriteParams } from '../../src/schemas/favorites.js';
import { dashboardQuery } from '../../src/schemas/dashboard.js';
import { EMOTIONS } from '../../src/schemas/emotions.js';
import { recommendationsQuery } from '../../src/schemas/recommendations.js';
import { searchQuery } from '../../src/schemas/search.js';

describe('schema de ánimo', () => {
  it.each(EMOTIONS)('acepta la emoción %s', (emotion) => {
    expect(createMoodBody.safeParse({ emotion }).success).toBe(true);
  });

  it('rechaza emociones desconocidas', () => {
    expect(createMoodBody.safeParse({ emotion: 'aburrido' }).success).toBe(false);
  });

  it('rechaza campos extra (nada de imágenes)', () => {
    expect(createMoodBody.safeParse({ emotion: 'happy', image: 'data:image/png;base64,AAA' }).success).toBe(false);
  });

  it('confidence debe estar entre 0 y 1', () => {
    expect(createMoodBody.safeParse({ emotion: 'sad', confidence: 1.5 }).success).toBe(false);
  });
});

describe('schema de favoritos', () => {
  const ok = { tmdbId: 550, mediaType: 'movie', title: 'Fight Club' };

  it('acepta un favorito válido', () => {
    expect(createFavoriteBody.safeParse(ok).success).toBe(true);
  });

  it('rechaza tmdbId no entero o negativo', () => {
    expect(createFavoriteBody.safeParse({ ...ok, tmdbId: -1 }).success).toBe(false);
    expect(createFavoriteBody.safeParse({ ...ok, tmdbId: 1.5 }).success).toBe(false);
  });

  it('rechaza mediaType inválido y título vacío', () => {
    expect(createFavoriteBody.safeParse({ ...ok, mediaType: 'anime' }).success).toBe(false);
    expect(createFavoriteBody.safeParse({ ...ok, title: '   ' }).success).toBe(false);
  });

  it('params convierte tmdbId a número', () => {
    expect(favoriteParams.parse({ mediaType: 'tv', tmdbId: '1399' })).toEqual({ mediaType: 'tv', tmdbId: 1399 });
  });
});

describe('schema del tablero', () => {
  it('days por defecto es 30', () => {
    expect(dashboardQuery.parse({}).days).toBe(30);
  });

  it('rechaza days fuera de rango', () => {
    expect(dashboardQuery.safeParse({ days: 0 }).success).toBe(false);
    expect(dashboardQuery.safeParse({ days: 9999 }).success).toBe(false);
  });
});

describe('schema de recomendaciones', () => {
  it.each(EMOTIONS)('acepta la emoción %s', (emotion) => {
    expect(recommendationsQuery.safeParse({ emotion }).success).toBe(true);
  });

  it('usa película, página 1 y guardar en el historial por defecto', () => {
    expect(recommendationsQuery.parse({ emotion: 'sad' })).toEqual({
      emotion: 'sad',
      mediaType: 'movie',
      page: 1,
      history: true,
    });
  });

  it('convierte page de texto a número (así llega en el query)', () => {
    expect(recommendationsQuery.parse({ emotion: 'happy', mediaType: 'tv', page: '3' })).toEqual({
      emotion: 'happy',
      mediaType: 'tv',
      page: 3,
      history: true,
    });
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('history=%s se convierte a %s', (texto, valor) => {
    expect(recommendationsQuery.parse({ emotion: 'sad', history: texto }).history).toBe(valor);
  });

  it.each(['0', 'no', 'False', ''])('rechaza history = "%s" (solo "true" o "false")', (history) => {
    expect(recommendationsQuery.safeParse({ emotion: 'sad', history }).success).toBe(false);
  });

  it('exige la emoción', () => {
    expect(recommendationsQuery.safeParse({}).success).toBe(false);
  });

  it('rechaza emociones desconocidas o con mayúsculas', () => {
    expect(recommendationsQuery.safeParse({ emotion: 'aburrido' }).success).toBe(false);
    expect(recommendationsQuery.safeParse({ emotion: 'Happy' }).success).toBe(false);
  });

  it('rechaza la emoción repetida en el query (?emotion=a&emotion=b llega como arreglo)', () => {
    expect(recommendationsQuery.safeParse({ emotion: ['happy', 'sad'] }).success).toBe(false);
  });

  it('rechaza mediaType inválido', () => {
    expect(recommendationsQuery.safeParse({ emotion: 'sad', mediaType: 'anime' }).success).toBe(false);
  });

  it.each(['0', '501', '1.5', 'abc'])('rechaza page = %s', (page) => {
    expect(recommendationsQuery.safeParse({ emotion: 'sad', page }).success).toBe(false);
  });

  it('ignora params desconocidos en vez de fallar', () => {
    expect(recommendationsQuery.parse({ emotion: 'sad', _: '123' })).not.toHaveProperty('_');
  });
});

describe('schema de búsqueda', () => {
  it('quita espacios y usa película y página 1 por defecto', () => {
    expect(searchQuery.parse({ query: '  coco  ' })).toEqual({ query: 'coco', mediaType: 'movie', page: 1 });
  });

  it('acepta series y convierte page', () => {
    expect(searchQuery.parse({ query: 'dark', mediaType: 'tv', page: '2' })).toEqual({
      query: 'dark',
      mediaType: 'tv',
      page: 2,
    });
  });

  it.each([
    ['sin texto', {}],
    ['texto vacío', { query: '' }],
    ['solo espacios', { query: '   ' }],
    ['más de 100 caracteres', { query: 'a'.repeat(101) }],
    ['texto repetido en el query (llega como arreglo)', { query: ['coco', 'up'] }],
    ['tipo inválido', { query: 'coco', mediaType: 'anime' }],
    ['página fuera de rango', { query: 'coco', page: '0' }],
  ])('rechaza %s', (_caso, datos) => {
    expect(searchQuery.safeParse(datos).success).toBe(false);
  });
});
