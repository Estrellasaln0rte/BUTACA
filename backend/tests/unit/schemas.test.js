import { describe, it, expect } from 'vitest';
import { createMoodBody } from '../../src/schemas/moods.js';
import { createFavoriteBody, favoriteParams } from '../../src/schemas/favorites.js';
import { dashboardQuery } from '../../src/schemas/dashboard.js';
import { EMOTIONS } from '../../src/schemas/emotions.js';

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