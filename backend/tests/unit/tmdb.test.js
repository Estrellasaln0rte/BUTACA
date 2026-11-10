import { describe, it, expect } from 'vitest';
import { createTmdbClient, TmdbError } from '../../src/services/tmdb.js';

const API_KEY = 'key-de-prueba-123';

// fetch falso: guarda la URL pedida y responde lo que se le indique.
function fakeFetch({ status = 200, body = { page: 1, total_pages: 1, total_results: 0, results: [] } } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: new URL(url), options });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (typeof body === 'function' ? body() : body),
    };
  };
  return { fetchImpl, calls };
}

const client = (fetchImpl, opts = {}) => createTmdbClient({ apiKey: API_KEY, fetchImpl, ...opts });

describe('cliente de TMDB: la petición', () => {
  it('llama a /discover/movie con los parámetros esperados', async () => {
    const { fetchImpl, calls } = fakeFetch();
    await client(fetchImpl).discover('movie', { genreIds: [35, 16], page: 2 });

    const { url } = calls[0];
    expect(url.origin + url.pathname).toBe('https://api.themoviedb.org/3/discover/movie');
    expect(url.searchParams.get('api_key')).toBe(API_KEY);
    expect(url.searchParams.get('with_genres')).toBe('35|16'); // "|" = cualquiera de los géneros
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('language')).toBe('es-MX');
    expect(url.searchParams.get('include_adult')).toBe('false');
    expect(url.searchParams.get('sort_by')).toBe('popularity.desc');
  });

  it('llama a /discover/tv para series', async () => {
    const { fetchImpl, calls } = fakeFetch();
    await client(fetchImpl).discover('tv', { genreIds: [10759] });
    expect(calls[0].url.pathname).toBe('/3/discover/tv');
    expect(calls[0].url.searchParams.get('page')).toBe('1');
  });

  it('manda una señal para cortar la petición si tarda', async () => {
    const { fetchImpl, calls } = fakeFetch();
    await client(fetchImpl).discover('movie', { genreIds: [35] });
    expect(calls[0].options.signal).toBeInstanceOf(AbortSignal);
  });

  it('rechaza un mediaType inválido sin llamar a TMDB', async () => {
    const { fetchImpl, calls } = fakeFetch();
    await expect(client(fetchImpl).discover('../account', { genreIds: [35] })).rejects.toThrow('mediaType');
    expect(calls).toHaveLength(0);
  });

  it('exige la API key al crearse', () => {
    expect(() => createTmdbClient({ apiKey: '' })).toThrow('API key');
  });
});

describe('cliente de TMDB: la respuesta', () => {
  it('normaliza una película', async () => {
    const { fetchImpl } = fakeFetch({
      body: {
        page: 1,
        total_pages: 3,
        total_results: 60,
        results: [
          { id: 550, title: 'El club de la pelea', overview: 'Un oficinista...', poster_path: '/abc.jpg', release_date: '1999-10-15', vote_average: 8.4 },
        ],
      },
    });

    const res = await client(fetchImpl).discover('movie', { genreIds: [18] });
    expect(res).toEqual({
      page: 1,
      totalPages: 3,
      totalResults: 60,
      items: [
        {
          tmdbId: 550,
          mediaType: 'movie',
          title: 'El club de la pelea',
          overview: 'Un oficinista...',
          posterPath: '/abc.jpg',
          releaseDate: '1999-10-15',
          rating: 8.4,
        },
      ],
    });
  });

  it('normaliza una serie (usa name y first_air_date)', async () => {
    const { fetchImpl } = fakeFetch({
      body: { results: [{ id: 1399, name: 'Juego de tronos', first_air_date: '2011-04-17', vote_average: 8.5 }] },
    });

    const [item] = (await client(fetchImpl).discover('tv', { genreIds: [10765] })).items;
    expect(item).toMatchObject({ tmdbId: 1399, mediaType: 'tv', title: 'Juego de tronos', releaseDate: '2011-04-17' });
  });

  it('pone null donde TMDB no trae datos', async () => {
    const { fetchImpl } = fakeFetch({
      body: { results: [{ id: 7, original_title: 'Sin traducir', poster_path: null, release_date: '' }] },
    });

    const [item] = (await client(fetchImpl).discover('movie', { genreIds: [35] })).items;
    expect(item).toMatchObject({ title: 'Sin traducir', overview: '', posterPath: null, releaseDate: null, rating: null });
  });

  it('nunca reporta más de 500 páginas', async () => {
    const { fetchImpl } = fakeFetch({ body: { page: 1, total_pages: 9000, results: [] } });
    expect((await client(fetchImpl).discover('movie', { genreIds: [35] })).totalPages).toBe(500);
  });

  it('tolera una respuesta sin results', async () => {
    const { fetchImpl } = fakeFetch({ body: {} });
    expect(await client(fetchImpl).discover('movie', { genreIds: [35], page: 4 })).toEqual({
      page: 4,
      totalPages: 0,
      totalResults: 0,
      items: [],
    });
  });
});

describe('cliente de TMDB: errores', () => {
  it('TMDB responde con error → TmdbError 502 que no expone la API key', async () => {
    const { fetchImpl } = fakeFetch({ status: 401, body: { status_message: 'Invalid API key' } });
    const err = await client(fetchImpl).discover('movie', { genreIds: [35] }).catch((e) => e);

    expect(err).toBeInstanceOf(TmdbError);
    expect(err.status).toBe(502);
    expect(err.upstreamStatus).toBe(401);
    expect(err.message).not.toContain(API_KEY);
  });

  it('sin conexión → TmdbError', async () => {
    const fetchImpl = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(client(fetchImpl).discover('movie', { genreIds: [35] })).rejects.toThrow('No se pudo conectar');
  });

  it('si tarda más que el timeout → TmdbError', async () => {
    // fetch que nunca responde, salvo que lo corte la señal de timeout
    const fetchImpl = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      });

    const err = await client(fetchImpl, { timeoutMs: 20 }).discover('movie', { genreIds: [35] }).catch((e) => e);
    expect(err).toBeInstanceOf(TmdbError);
    expect(err.message).toBe('TMDB no respondió a tiempo');
  });

  it('JSON inválido → TmdbError', async () => {
    const { fetchImpl } = fakeFetch({
      body: () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    await expect(client(fetchImpl).discover('movie', { genreIds: [35] })).rejects.toThrow('respuesta inválida');
  });
});

describe('cliente de TMDB: búsqueda por título', () => {
  it('llama a /search/movie con el texto, sin adultos y la página pedida', async () => {
    const { fetchImpl, calls } = fakeFetch();
    await client(fetchImpl).search('movie', { query: 'el club de la pelea', page: 2 });

    const { url } = calls[0];
    expect(url.pathname).toBe('/3/search/movie');
    expect(url.searchParams.get('query')).toBe('el club de la pelea');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('include_adult')).toBe('false');
    expect(url.searchParams.get('language')).toBe('es-MX');
    // A diferencia de discover, no filtra por votos ni por géneros.
    expect(url.searchParams.has('vote_count.gte')).toBe(false);
    expect(url.searchParams.has('with_genres')).toBe(false);
  });

  it('llama a /search/tv y normaliza igual que discover', async () => {
    const { fetchImpl, calls } = fakeFetch({
      body: { page: 1, total_pages: 1, total_results: 1, results: [{ id: 70523, name: 'Dark', first_air_date: '2017-12-01' }] },
    });
    const res = await client(fetchImpl).search('tv', { query: 'dark' });

    expect(calls[0].url.pathname).toBe('/3/search/tv');
    expect(res.items[0]).toMatchObject({ tmdbId: 70523, mediaType: 'tv', title: 'Dark', releaseDate: '2017-12-01' });
  });

  it('rechaza un mediaType inválido sin llamar a TMDB', async () => {
    const { fetchImpl, calls } = fakeFetch();
    await expect(client(fetchImpl).search('person', { query: 'x' })).rejects.toThrow('mediaType');
    expect(calls).toHaveLength(0);
  });

  it('un error de TMDB se convierte en TmdbError', async () => {
    const { fetchImpl } = fakeFetch({ status: 500 });
    await expect(client(fetchImpl).search('movie', { query: 'coco' })).rejects.toBeInstanceOf(TmdbError);
  });
});
