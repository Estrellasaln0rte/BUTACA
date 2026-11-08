// Regla ánimo → géneros de TMDB.
//
// Criterio: recomendar algo que ayude con el ánimo detectado, no solo que lo refleje
// (triste → algo que levante; enojado → algo para descargar; con miedo → algo tranquilo).
// Si el equipo cambia el criterio, se cambia SOLO la tabla MOOD_GENRES.
//
// TMDB usa IDs distintos para películas y series, y algunos géneros no existen en series
// (Terror, Romance, Thriller...). Por eso hay un catálogo y un mapa para cada tipo.
// IDs oficiales: GET /genre/movie/list y GET /genre/tv/list.

export const MOVIE_GENRES = Object.freeze({
  ACTION: { id: 28, name: 'Acción' },
  ADVENTURE: { id: 12, name: 'Aventura' },
  ANIMATION: { id: 16, name: 'Animación' },
  COMEDY: { id: 35, name: 'Comedia' },
  DRAMA: { id: 18, name: 'Drama' },
  FAMILY: { id: 10751, name: 'Familia' },
  FANTASY: { id: 14, name: 'Fantasía' },
  MUSIC: { id: 10402, name: 'Música' },
  MYSTERY: { id: 9648, name: 'Misterio' },
  ROMANCE: { id: 10749, name: 'Romance' },
  SCIENCE_FICTION: { id: 878, name: 'Ciencia ficción' },
  THRILLER: { id: 53, name: 'Suspenso' },
});

export const TV_GENRES = Object.freeze({
  ACTION_ADVENTURE: { id: 10759, name: 'Acción y aventura' },
  ANIMATION: { id: 16, name: 'Animación' },
  COMEDY: { id: 35, name: 'Comedia' },
  CRIME: { id: 80, name: 'Crimen' },
  DRAMA: { id: 18, name: 'Drama' },
  FAMILY: { id: 10751, name: 'Familia' },
  MYSTERY: { id: 9648, name: 'Misterio' },
  SCI_FI_FANTASY: { id: 10765, name: 'Ciencia ficción y fantasía' },
});

const M = MOVIE_GENRES;
const T = TV_GENRES;

// Una entrada por cada emoción de schemas/emotions.js (las 7 de face-api.js).
// Las pruebas fallan si falta alguna o si se usa un ID que no existe para ese tipo.
export const MOOD_GENRES = Object.freeze({
  movie: Object.freeze({
    happy: [M.COMEDY, M.ADVENTURE, M.MUSIC], // mantener la buena racha
    sad: [M.COMEDY, M.ANIMATION, M.FAMILY], // levantar el ánimo
    angry: [M.ACTION, M.THRILLER], // descargar la energía
    fearful: [M.ANIMATION, M.FAMILY, M.COMEDY], // algo tranquilo y seguro
    disgusted: [M.ROMANCE, M.FANTASY], // algo amable para limpiar la sensación
    surprised: [M.MYSTERY, M.SCIENCE_FICTION], // seguir con la intriga
    neutral: [M.DRAMA, M.ADVENTURE, M.SCIENCE_FICTION], // variedad para descubrir
  }),
  tv: Object.freeze({
    happy: [T.COMEDY, T.ACTION_ADVENTURE],
    sad: [T.COMEDY, T.ANIMATION, T.FAMILY],
    angry: [T.ACTION_ADVENTURE, T.CRIME],
    fearful: [T.ANIMATION, T.FAMILY, T.COMEDY],
    disgusted: [T.FAMILY, T.SCI_FI_FANTASY],
    surprised: [T.MYSTERY, T.SCI_FI_FANTASY],
    neutral: [T.DRAMA, T.SCI_FI_FANTASY],
  }),
});

// Devuelve los géneros ({ id, name }) a recomendar para una emoción y un tipo.
// Devuelve copias: quien la use puede modificar el resultado sin tocar la tabla.
// La ruta ya valida con Zod antes de llamar; el error es solo una red de seguridad.
export function genresForEmotion(emotion, mediaType = 'movie') {
  const byType = Object.hasOwn(MOOD_GENRES, mediaType) ? MOOD_GENRES[mediaType] : null;
  const genres = byType && Object.hasOwn(byType, emotion) ? byType[emotion] : null;

  if (!genres) {
    throw new Error(`No hay géneros para emoción "${emotion}" y tipo "${mediaType}"`);
  }

  return genres.map((g) => ({ ...g }));
}
