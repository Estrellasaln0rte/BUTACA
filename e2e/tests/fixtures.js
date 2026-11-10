import { test as base, expect } from '@playwright/test';
import { E2E } from '../constantes.js';

// supabase-js guarda la sesión en localStorage con esta clave: sb-<id del proyecto>-auth-token
const CLAVE_SESION = `sb-${new URL(E2E.supabaseUrl).hostname.split('.')[0]}-auth-token`;

export const USUARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'e2e@butaca.test',
};

const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

// Un JWT con forma válida (no está firmado: acá nadie lo verifica, la API es de mentira).
function tokenDePrueba() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    exp,
    token: [
      base64url({ alg: 'HS256', typ: 'JWT' }),
      base64url({ sub: USUARIO.id, email: USUARIO.email, role: 'authenticated', aud: 'authenticated', exp }),
      'firma-de-prueba',
    ].join('.'),
  };
}

export const PELICULAS = [
  {
    tmdbId: 101,
    title: 'La Gran Risa',
    overview: 'Una comedia para levantar el ánimo.',
    posterPath: '/poster-gran-risa.jpg',
    releaseDate: '2024-05-10',
    rating: 7.8,
  },
  {
    tmdbId: 102,
    title: 'Viaje Feliz',
    overview: 'Aventura liviana para toda la familia.',
    posterPath: null,
    releaseDate: '2023-11-02',
    rating: 6.9,
  },
];

// Lo que devuelve la página 2 de películas: repite una de la página 1 (TMDB a veces lo hace)
export const PELICULAS_PAGINA_2 = [
  PELICULAS[1],
  {
    tmdbId: 103,
    title: 'Risas en el Camino',
    overview: 'Otra comedia más.',
    posterPath: null,
    releaseDate: '2022-03-15',
    rating: 7.1,
  },
];

export const SERIES = [
  {
    tmdbId: 201,
    title: 'Oficina Divertida',
    overview: 'Una serie de comedia.',
    posterPath: null,
    releaseDate: '2021-01-20',
    rating: 8.2,
  },
];
// Títulos que solo aparecen al buscar (no están en las recomendaciones)
export const CATALOGO = {
  movie: [
    {
      tmdbId: 301,
      title: 'Coco',
      overview: 'Un niño viaja a la Tierra de los Muertos.',
      posterPath: null,
      releaseDate: '2017-10-27',
      rating: 8.2,
    },
    {
      tmdbId: 302,
      title: 'Acción Total',
      overview: 'Explosiones de principio a fin.',
      posterPath: null,
      releaseDate: '2020-06-01',
      rating: 6.4,
    },
  ],
  tv: [
    {
      tmdbId: 401,
      title: 'Coco y sus Amigos',
      overview: 'Serie animada.',
      posterPath: null,
      releaseDate: '2019-02-02',
      rating: 7.0,
    },
  ],
};

// Igual que el front: sin tildes ni mayúsculas
const normalizar = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Un PNG de 1x1 para responder los pósters sin salir a internet
const PNG_VACIO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Backend de mentira con el mismo contrato que el real. Guarda en `llamadas` todo lo que recibe
// para que las pruebas revisen qué mandó el front (headers y payloads).
async function montarApi(page) {
  // Las pruebas pueden cambiar `favoritas` o `tablero` antes de abrir la página
  const estado = {
    favoritas: [],
    animos: [],
    llamadas: [],
    tablero: { moodsOverTime: [], recommendedGenres: [] },
  };

  await page.route(`${E2E.apiUrl}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    const url = new URL(req.url());
    const ruta = url.pathname.replace(new URL(E2E.apiUrl).pathname, '');
    const cuerpo = req.postDataJSON?.() ?? null;
    estado.llamadas.push({ metodo: req.method(), ruta, query: url.searchParams, cuerpo, headers: req.headers() });

    const responder = (status, json) =>
      route.fulfill({ status, headers: CORS, contentType: 'application/json', body: json ? JSON.stringify(json) : '' });

    // Igual que requireAuth: sin Bearer no hay datos
    if (!req.headers().authorization?.startsWith('Bearer ')) return responder(401, { error: 'No autenticado' });

    if (ruta === '/moods' && req.method() === 'POST') {
      const animo = { id: `m${estado.animos.length + 1}`, ...cuerpo, createdAt: new Date().toISOString() };
      estado.animos.push(animo);
      return responder(201, animo);
    }
    if (ruta === '/moods') return responder(200, { items: estado.animos });

    if (ruta === '/recommendations') {
      const mediaType = url.searchParams.get('mediaType');
      const pagina = Number(url.searchParams.get('page') ?? 1);
      const items = mediaType === 'tv' ? SERIES : pagina === 2 ? PELICULAS_PAGINA_2 : PELICULAS;
      return responder(200, {
        emotion: url.searchParams.get('emotion'),
        mediaType,
        genres: [{ id: 35, name: 'Comedia' }],
        page: pagina,
        totalPages: mediaType === 'tv' ? 1 : 2,
        totalResults: 4,
        items,
      });
    }
    
    if (ruta === '/search') {
      const query = url.searchParams.get('query') ?? '';
      const mediaType = url.searchParams.get('mediaType') ?? 'movie';
      const items = CATALOGO[mediaType].filter((i) => normalizar(i.title).includes(normalizar(query.trim())));
      return responder(200, { query, mediaType, page: 1, totalPages: 1, totalResults: items.length, items });
    }

    if (ruta === '/dashboard') {
      return responder(200, { days: Number(url.searchParams.get('days') ?? 30), ...estado.tablero });
    }

    if (ruta === '/favorites' && req.method() === 'GET') return responder(200, { items: estado.favoritas });
    if (ruta === '/favorites' && req.method() === 'POST') {
      if (estado.favoritas.some((f) => f.tmdbId === cuerpo.tmdbId && f.mediaType === cuerpo.mediaType)) {
        return responder(409, { error: 'Ya está en favoritas' });
      }
      const favorita = { id: `f${cuerpo.tmdbId}`, ...cuerpo, createdAt: new Date().toISOString() };
      estado.favoritas.push(favorita);
      return responder(201, favorita);
    }
    const borrar = ruta.match(/^\/favorites\/(movie|tv)\/(\d+)$/);
    if (borrar && req.method() === 'DELETE') {
      const antes = estado.favoritas.length;
      estado.favoritas = estado.favoritas.filter(
        (f) => !(f.mediaType === borrar[1] && f.tmdbId === Number(borrar[2])),
      );
      return estado.favoritas.length < antes ? responder(204) : responder(404, { error: 'Favorito no encontrado' });
    }

    return responder(404, { error: 'Ruta no encontrada' });
  });

  return estado;
}

// Cualquier llamada a Supabase (refresh, logout...) se responde acá; nunca sale a internet.
// Los pósters de TMDB también se responden con una imagen vacía.
async function montarSupabase(page) {
  await page.route('https://image.tmdb.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG_VACIO }),
  );
  await page.route(`${E2E.supabaseUrl}/**`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (route.request().url().includes('/auth/v1/logout')) return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{}' });
  });
}

export const test = base.extend({
  // Página sin sesión, con Supabase y la API interceptados
  api: async ({ page }, use) => {
    await montarSupabase(page);
    await use(await montarApi(page));
  },

  // Igual que `api`, pero con una sesión ya iniciada (como si el usuario volviera de Google/GitHub)
  conSesion: async ({ page, api }, use) => {
    const { token, exp } = tokenDePrueba();
    const sesion = {
      access_token: token,
      refresh_token: 'refresh-de-prueba',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: exp,
      user: {
        id: USUARIO.id,
        email: USUARIO.email,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'github' },
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    };
    await page.addInitScript(
      ([clave, valor]) => {
        // Solo la primera carga: así "Cerrar sesión" puede borrarla y no vuelve al recargar
        if (!sessionStorage.getItem('e2e-sesion-puesta')) {
          localStorage.setItem(clave, valor);
          sessionStorage.setItem('e2e-sesion-puesta', '1');
        }
      },
      [CLAVE_SESION, JSON.stringify(sesion)],
    );
    await use({ api, token });
  },
});

// Reemplaza la respuesta de una ruta de la API. Se registra después de la API de mentira, así que le gana.
// Devuelve una función para "arreglar" la ruta: desde ahí responde otra vez el back de mentira.
export async function forzarRespuesta(page, ruta, status, json) {
  let activa = true;
  const camino = new URL(E2E.apiUrl).pathname + ruta;
  await page.route((url) => url.href.startsWith(E2E.apiUrl) && url.pathname === camino, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (!activa) return route.fallback();
    return route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(json) });
  });
  return () => {
    activa = false;
  };
}

export { expect };