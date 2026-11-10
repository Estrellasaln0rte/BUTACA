import { test, expect, forzarRespuesta, PELICULAS, CATALOGO } from './fixtures.js';

const busquedas = (api) => api.llamadas.filter((l) => l.ruta === '/search');
const buscador = (page) => page.getByRole('searchbox', { name: 'Buscar películas o series por título' });
// Hay dos botones "Borrar búsqueda": la × dentro del buscador y el botón grande cuando no hay resultados
const cruz = (page) => page.getByRole('search').getByRole('button', { name: 'Borrar búsqueda' });
const botonBorrar = (page) => page.locator('.rec-estado').getByRole('button', { name: 'Borrar búsqueda' });

test.describe('Buscar por título en recomendaciones', () => {
  test('muestra resultados de TMDB en vez de las recomendaciones', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/recomendaciones?emotion=happy');
    await expect(page.getByRole('heading', { name: PELICULAS[0].title })).toBeVisible();

    await buscador(page).fill('coco');

    await expect(page.getByRole('heading', { name: 'Coco', exact: true })).toBeVisible();
    await expect(page.getByText('Resultados para “coco” en películas')).toBeVisible();
    await expect(page.getByRole('heading', { name: PELICULAS[0].title })).toHaveCount(0);

    const pedido = busquedas(api).at(-1);
    expect(pedido.query.get('query')).toBe('coco');
    expect(pedido.query.get('mediaType')).toBe('movie');
    expect(pedido.headers.authorization).toMatch(/^Bearer /);

    // Buscar es solo navegar: no guarda nada en el back
    expect(api.llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0);
  });

  test('espera a que termines de escribir: una sola búsqueda, no una por letra', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/recomendaciones?emotion=happy');
    await expect(page.getByRole('heading', { name: PELICULAS[0].title })).toBeVisible();

    await buscador(page).pressSequentially('coco', { delay: 80 });
    await expect(page.getByRole('heading', { name: 'Coco', exact: true })).toBeVisible();

    // Esto cuida el límite de 30 búsquedas por minuto del back
    expect(busquedas(api)).toHaveLength(1);
    expect(busquedas(api)[0].query.get('query')).toBe('coco');
  });

  test('en la pestaña Series busca series', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/recomendaciones?emotion=happy');
    await page.getByRole('tab', { name: 'Series' }).click();
    await expect(buscador(page)).toHaveAttribute('placeholder', 'Buscar series por título…');

    await buscador(page).fill('coco');
    await expect(page.getByRole('heading', { name: CATALOGO.tv[0].title })).toBeVisible();
    await expect(page.getByText('Resultados para “coco” en series')).toBeVisible();
    expect(busquedas(api).at(-1).query.get('mediaType')).toBe('tv');
  });

  test('sin resultados: avisa, y "Borrar búsqueda" vuelve a las recomendaciones', async ({ page, conSesion }) => {
    await page.goto('/recomendaciones?emotion=happy');
    await buscador(page).fill('zzzz');

    await expect(page.getByText('No encontramos “zzzz” en películas')).toBeVisible();
    await botonBorrar(page).click();

    await expect(buscador(page)).toHaveValue('');
    await expect(page.getByRole('heading', { name: PELICULAS[0].title })).toBeVisible();
  });

  test('Escape y la × limpian la búsqueda', async ({ page, conSesion }) => {
    await page.goto('/recomendaciones?emotion=happy');

    await buscador(page).fill('coco');
    await expect(page.getByRole('heading', { name: 'Coco', exact: true })).toBeVisible();
    await buscador(page).press('Escape');
    await expect(buscador(page)).toHaveValue('');
    await expect(page.getByRole('heading', { name: PELICULAS[0].title })).toBeVisible();

    await buscador(page).fill('coco');
    await expect(page.getByRole('heading', { name: 'Coco', exact: true })).toBeVisible();
    await cruz(page).click();
    await expect(buscador(page)).toHaveValue('');
    await expect(page.getByRole('heading', { name: PELICULAS[0].title })).toBeVisible();
  });

  test('se puede guardar en favoritas un título encontrado', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/recomendaciones?emotion=happy');
    await buscador(page).fill('coco');
    await page.getByRole('button', { name: 'Guardar Coco en favoritas' }).click();

    await expect(page.getByRole('button', { name: 'Quitar Coco de favoritas' })).toHaveAttribute('aria-pressed', 'true');
    const alta = api.llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/favorites');
    expect(alta.cuerpo).toEqual({ tmdbId: 301, mediaType: 'movie', title: 'Coco', posterPath: null });
  });

  test('si TMDB falla al buscar, avisa y se puede reintentar', async ({ page, conSesion }) => {
    const arreglar = await forzarRespuesta(page, '/search', 502, { error: 'TMDB no disponible' });
    await page.goto('/recomendaciones?emotion=happy');
    await buscador(page).fill('coco');

    await expect(page.getByRole('alert')).toContainText('El catálogo de películas no responde');
    arreglar();
    await page.getByRole('button', { name: 'Intentar de nuevo' }).click();
    await expect(page.getByRole('heading', { name: 'Coco', exact: true })).toBeVisible();
  });
});

const FAVORITAS = [
  { id: 'f101', tmdbId: 101, mediaType: 'movie', title: 'La Gran Risa', posterPath: null, createdAt: '2026-11-01T12:00:00Z' },
  { id: 'f302', tmdbId: 302, mediaType: 'movie', title: 'Acción Total', posterPath: null, createdAt: '2026-11-02T12:00:00Z' },
  { id: 'f401', tmdbId: 401, mediaType: 'tv', title: 'Coco y sus Amigos', posterPath: null, createdAt: '2026-11-03T12:00:00Z' },
];

test.describe('Buscar en favoritas', () => {
  const buscadorFav = (page) => page.getByRole('searchbox', { name: 'Buscar en tus favoritas' });
  const titulos = (page) => page.locator('.rec-grilla .rec-nombre');

  test('filtra por título sin importar tildes ni mayúsculas, sin llamar al back', async ({ page, conSesion }) => {
    const { api } = conSesion;
    api.favoritas = structuredClone(FAVORITAS);
    await page.goto('/favoritas');
    await expect(titulos(page)).toHaveCount(3);

    await buscadorFav(page).fill('RISA');
    await expect(titulos(page)).toHaveText(['La Gran Risa']);

    await buscadorFav(page).fill('accion'); // sin tilde encuentra "Acción"
    await expect(titulos(page)).toHaveText(['Acción Total']);

    // Es un filtro local: las favoritas ya están cargadas
    expect(busquedas(api)).toHaveLength(0);
  });

  test('se combina con el filtro de Películas/Series', async ({ page, conSesion }) => {
    conSesion.api.favoritas = structuredClone(FAVORITAS);
    await page.goto('/favoritas');

    await buscadorFav(page).fill('coco');
    await expect(titulos(page)).toHaveText(['Coco y sus Amigos']);

    await page.getByRole('tab', { name: 'Películas' }).click();
    await expect(page.getByText('No encontramos “coco” entre tus películas guardadas')).toBeVisible();

    await page.getByRole('tab', { name: 'Series' }).click();
    await expect(titulos(page)).toHaveText(['Coco y sus Amigos']);
  });

  test('sin coincidencias: avisa y "Borrar búsqueda" muestra todo otra vez', async ({ page, conSesion }) => {
    conSesion.api.favoritas = structuredClone(FAVORITAS);
    await page.goto('/favoritas');

    await buscadorFav(page).fill('zzzz');
    await expect(page.getByText('No encontramos “zzzz” entre tus favoritas')).toBeVisible();

    await botonBorrar(page).click();
    await expect(buscadorFav(page)).toHaveValue('');
    await expect(titulos(page)).toHaveCount(3);
  });
});