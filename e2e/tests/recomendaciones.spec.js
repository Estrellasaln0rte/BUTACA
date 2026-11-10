import { test, expect, forzarRespuesta, PELICULAS, PELICULAS_PAGINA_2, SERIES } from './fixtures.js';

const pedidosDe = (api, ruta) => api.llamadas.filter((l) => l.ruta === ruta);
const tarjetas = (page) => page.locator('.rec-grilla > li:not(.esqueleto)');

test.describe('Recomendaciones', () => {
  test('cambiar a Series pide mediaType=tv y muestra series', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/recomendaciones?emotion=happy');
    await expect(page.getByRole('heading', { name: PELICULAS[0].title })).toBeVisible();

    await page.getByRole('tab', { name: 'Series' }).click();
    await expect(page).toHaveURL(/tipo=tv/);
    await expect(page.getByRole('heading', { name: SERIES[0].title })).toBeVisible();
    await expect(page.getByRole('heading', { name: PELICULAS[0].title })).toHaveCount(0);

    const ultimo = pedidosDe(api, '/recommendations').at(-1);
    expect(ultimo.query.get('mediaType')).toBe('tv');
    expect(ultimo.query.get('emotion')).toBe('happy');
  });

  test('ver para otro ánimo pide esa emoción, sin guardarla en el historial', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/recomendaciones?emotion=happy');
    await expect(page.getByRole('heading', { name: /Elegidas para tu/ })).toContainText('alegría');

    await page
      .getByRole('group', { name: 'Ver recomendaciones para otro ánimo' })
      .getByRole('button', { name: 'Miedo' })
      .click();
    await expect(page).toHaveURL(/emotion=fearful/);
    await expect(page.getByRole('heading', { name: /Elegidas para tu/ })).toContainText('miedo');

    expect(pedidosDe(api, '/recommendations').at(-1).query.get('emotion')).toBe('fearful');
    expect(api.llamadas.some((l) => l.metodo === 'POST' && l.ruta === '/moods')).toBe(false);
  });

  test('"Ver más" trae la página 2 sin repetir títulos', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/recomendaciones?emotion=happy');
    await expect(tarjetas(page)).toHaveCount(PELICULAS.length);

    await page.getByRole('button', { name: 'Ver más' }).click();
    await expect(page.getByRole('heading', { name: PELICULAS_PAGINA_2[1].title })).toBeVisible();

    // 2 de la página 1 + 1 nueva (la repetida no se duplica)
    await expect(tarjetas(page)).toHaveCount(3);
    await expect(page.getByRole('heading', { name: PELICULAS[1].title })).toHaveCount(1);
    expect(pedidosDe(api, '/recommendations').at(-1).query.get('page')).toBe('2');

    // Era la última página: el botón desaparece
    await expect(page.getByRole('button', { name: 'Ver más' })).toHaveCount(0);
  });

  test('una emoción inválida en la URL vuelve al inicio', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/recomendaciones?emotion=hackeado');
    await expect(page).toHaveURL(/\/$/);
    expect(pedidosDe(api, '/recommendations')).toHaveLength(0);
  });
});

test.describe('Cuando algo falla', () => {
  test('TMDB caído (502): avisa y se puede reintentar', async ({ page, conSesion }) => {
    const arreglar = await forzarRespuesta(page, '/recommendations', 502, {
      error: 'El servicio de películas no está disponible',
    });
    await page.goto('/recomendaciones?emotion=happy');

    await expect(page.getByRole('alert')).toContainText('El catálogo de películas no responde');
    arreglar(); // TMDB vuelve
    await page.getByRole('button', { name: 'Intentar de nuevo' }).click();
    await expect(page.getByRole('heading', { name: PELICULAS[0].title })).toBeVisible();
  });

  test('demasiadas solicitudes (429): avisa que espere', async ({ page, conSesion }) => {
    await forzarRespuesta(page, '/recommendations', 429, { error: 'Demasiadas solicitudes' });
    await page.goto('/recomendaciones?emotion=happy');
    await expect(page.getByRole('alert')).toContainText('Hiciste muchas solicitudes seguidas');
  });

  test('si no se puede guardar el ánimo, igual muestra recomendaciones', async ({ page, conSesion }) => {
    await forzarRespuesta(page, '/moods', 500, { error: 'Error interno' });
    await page.goto('/');
    await page.getByRole('group', { name: /Elegí cómo te sentís/ }).getByRole('button', { name: 'Alegría' }).click();

    await expect(page).toHaveURL(/\/recomendaciones\?emotion=happy/);
    await expect(page.getByRole('heading', { name: PELICULAS[0].title })).toBeVisible();
  });

  test('sin conexión con el back: avisa en vez de quedarse en blanco', async ({ page, conSesion }) => {
    await page.route('**/api/recommendations**', (route) => route.abort('connectionrefused'));
    await page.goto('/recomendaciones?emotion=happy');
    await expect(page.getByRole('alert')).toContainText('No se pudo conectar con el servidor');
  });
});