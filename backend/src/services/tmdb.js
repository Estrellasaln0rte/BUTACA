// Cliente de TMDB (API v3). Solo lo usa el backend: la API key nunca llega al navegador.
// Docs: https://developer.themoviedb.org/reference/discover-movie
//
// `fetchImpl` se inyecta para poder probarlo sin internet ni key real (ver tests/unit/tmdb.test.js).

const MEDIA_TYPES = ['movie', 'tv'];
const MAX_PAGES = 500; // TMDB no entrega más allá de la página 500

// Error de un servicio externo. La ruta lo traduce a 502 (Bad Gateway).
// El mensaje NUNCA incluye la URL: lleva la API key en el query.
export class TmdbError extends Error {
  constructor(message, { upstreamStatus, cause } = {}) {
    super(message, { cause });
    this.name = 'TmdbError';
    this.status = 502;
    this.upstreamStatus = upstreamStatus;
  }
}

export function createTmdbClient({
  apiKey,
  fetchImpl = globalThis.fetch,
  baseUrl = 'https://api.themoviedb.org/3',
  language = 'es-MX',
  timeoutMs = 5000,
} = {}) {
  if (!apiKey) throw new Error('Falta la API key de TMDB');

  async function request(path, params) {
    const url = new URL(`${baseUrl}${path}`);
    url.search = new URLSearchParams({ api_key: apiKey, language, ...params }).toString();

    let res;
    try {
      res = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      throw new TmdbError(timedOut ? 'TMDB no respondió a tiempo' : 'No se pudo conectar con TMDB', {
        cause: err,
      });
    }

    if (!res.ok) {
      throw new TmdbError(`TMDB respondió ${res.status}`, { upstreamStatus: res.status });
    }

    try {
      return await res.json();
    } catch (err) {
      throw new TmdbError('TMDB devolvió una respuesta inválida', { cause: err });
    }
  }

  return {
    // Busca títulos populares de esos géneros. Basta con que tenga UNO de ellos ("|" = o).
    async discover(mediaType, { genreIds = [], page = 1 } = {}) {
      // Se valida aquí también porque mediaType va dentro de la ruta de la URL.
      if (!MEDIA_TYPES.includes(mediaType)) {
        throw new Error(`mediaType inválido: ${mediaType}`);
      }

      const data = await request(`/discover/${mediaType}`, {
        with_genres: genreIds.join('|'),
        sort_by: 'popularity.desc',
        include_adult: 'false',
        'vote_count.gte': '50', // evita títulos casi desconocidos, sin póster ni reseñas
        page: String(page),
      });

      const results = Array.isArray(data?.results) ? data.results : [];

      return {
        page: data?.page ?? page,
        totalPages: Math.min(data?.total_pages ?? 0, MAX_PAGES),
        totalResults: data?.total_results ?? 0,
        items: results.map((r) => toItem(r, mediaType)),
      };
    },
  };
}

// Deja cada resultado con la misma forma para películas y series, y compatible con
// POST /api/favorites ({ tmdbId, mediaType, title, posterPath }).
// En series TMDB usa `name` y `first_air_date` en vez de `title` y `release_date`.
function toItem(r, mediaType) {
  return {
    tmdbId: r.id,
    mediaType,
    title: r.title || r.name || r.original_title || r.original_name || '',
    overview: r.overview || '',
    posterPath: r.poster_path || null,
    releaseDate: r.release_date || r.first_air_date || null,
    rating: typeof r.vote_average === 'number' ? r.vote_average : null,
  };
}
