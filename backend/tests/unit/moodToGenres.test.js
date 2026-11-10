import { describe, it, expect } from 'vitest';
import { EMOTIONS } from '../../src/schemas/emotions.js';
import { MOOD_GENRES, genresForEmotion } from '../../src/services/moodToGenres.js';

// IDs oficiales de TMDB (GET /genre/movie/list y /genre/tv/list), copiados aparte
// a propósito: así la prueba no confía en el mismo catálogo que está revisando.
const OFFICIAL_IDS = {
  movie: [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37],
  tv: [10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10763, 10764, 10765, 10766, 10767, 10768, 37],
};

const MEDIA_TYPES = ['movie', 'tv'];
const combos = MEDIA_TYPES.flatMap((mediaType) => EMOTIONS.map((emotion) => [emotion, mediaType]));

describe('regla ánimo → géneros', () => {
  it.each(combos)('%s (%s) tiene al menos un género', (emotion, mediaType) => {
    expect(genresForEmotion(emotion, mediaType).length).toBeGreaterThan(0);
  });

  it.each(combos)('%s (%s) solo usa IDs que existen para ese tipo', (emotion, mediaType) => {
    for (const { id } of genresForEmotion(emotion, mediaType)) {
      expect(OFFICIAL_IDS[mediaType]).toContain(id);
    }
  });

  it.each(combos)('%s (%s) no repite géneros', (emotion, mediaType) => {
    const ids = genresForEmotion(emotion, mediaType).map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(MEDIA_TYPES)('el mapa de %s cubre exactamente las emociones del contrato', (mediaType) => {
    expect(Object.keys(MOOD_GENRES[mediaType]).sort()).toEqual([...EMOTIONS].sort());
  });

  it('cada género trae id y nombre para mostrar en el front', () => {
    expect(genresForEmotion('sad', 'movie')[0]).toEqual({ id: 35, name: 'Comedia' });
  });

  it('usa películas por defecto', () => {
    expect(genresForEmotion('angry')).toEqual(genresForEmotion('angry', 'movie'));
  });

  it('series y películas usan IDs distintos cuando el género no se comparte', () => {
    const movieIds = genresForEmotion('angry', 'movie').map((g) => g.id);
    const tvIds = genresForEmotion('angry', 'tv').map((g) => g.id);
    expect(movieIds).toContain(28); // Acción (película)
    expect(tvIds).toContain(10759); // Acción y aventura (serie)
  });

  it('devuelve copias: modificar el resultado no altera la tabla', () => {
    const genres = genresForEmotion('happy', 'movie');
    genres[0].name = 'cambiado';
    genres.push({ id: 1, name: 'extra' });
    expect(genresForEmotion('happy', 'movie')[0].name).toBe('Comedia');
    expect(genresForEmotion('happy', 'movie')).toHaveLength(3);
  });

  it.each([
    ['aburrido', 'movie'],
    ['happy', 'anime'],
    ['toString', 'movie'], // no debe colarse una propiedad heredada de Object
  ])('lanza error con emoción "%s" y tipo "%s"', (emotion, mediaType) => {
    expect(() => genresForEmotion(emotion, mediaType)).toThrow();
  });
});
