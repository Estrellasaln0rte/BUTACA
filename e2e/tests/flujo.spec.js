import { test, expect, USUARIO, PELICULAS, CORS } from './fixtures.js';

test.describe('Sin sesión', () => {
  test('las rutas protegidas mandan al login', async ({ page, api }) => {
    for (const ruta of ['/', '/favoritas', '/tablero', '/recomendaciones?emotion=happy']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar con GitHub' })).toBeVisible();

    // Sin sesión el front no debería ni intentar pedir datos al back
    expect(api.llamadas).toHaveLength(0);
  });
});

test.describe('Con sesión', () => {
  test('flujo completo: ánimo → recomendaciones → favorita → quitarla', async ({ page, conSesion }) => {
    const { api, token } = conSesion;

    await page.goto('/');
    await expect(page.getByText(USUARIO.email)).toBeVisible();
    await expect(page.getByRole('heading', { name: /¿Cómo te sentís/ })).toBeVisible();

    // 1. Elegir el ánimo a mano (sin cámara)
    await page.getByRole('group', { name: /Elegí cómo te sentís/ }).getByRole('button', { name: 'Alegría' }).click();

    // 2. Recomendaciones
    await expect(page).toHaveURL(/\/recomendaciones\?emotion=happy/);
    await expect(page.getByRole('heading', { name: /Elegidas para tu/ })).toContainText('alegría');
    for (const peli of PELICULAS) {
      await expect(page.getByRole('heading', { name: peli.title })).toBeVisible();
    }

    // El ánimo se guardó con el formato del schema y con el token correcto
    const animo = api.llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/moods');
    expect(animo.cuerpo).toEqual({ emotion: 'happy' });
    expect(animo.headers.authorization).toBe(`Bearer ${token}`);

    const pedido = api.llamadas.find((l) => l.ruta === '/recommendations');
    expect(pedido.query.get('emotion')).toBe('happy');
    expect(pedido.query.get('mediaType')).toBe('movie');

    // 3. Guardar en favoritas
    const peli = PELICULAS[0];
    await page.getByRole('button', { name: `Guardar ${peli.title} en favoritas` }).click();
    await expect(page.getByRole('button', { name: `Quitar ${peli.title} de favoritas` })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // El POST manda solo los 4 campos que acepta el schema estricto del back
    const alta = api.llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/favorites');
    expect(alta.cuerpo).toEqual({
      tmdbId: peli.tmdbId,
      mediaType: 'movie',
      title: peli.title,
      posterPath: peli.posterPath,
    });

    // 4. Verla en Favoritas y quitarla
    await page.getByRole('link', { name: 'Favoritas' }).click();
    await expect(page).toHaveURL(/\/favoritas$/);
    await expect(page.getByText('1 título guardado')).toBeVisible();
    await expect(page.getByRole('heading', { name: peli.title })).toBeVisible();

    await page.getByRole('button', { name: `Quitar ${peli.title} de favoritas` }).click();
    await expect(page.getByText(`Quitaste "${peli.title}"`)).toBeVisible();
    await expect(page.getByText(/Todavía no guardaste nada/)).toBeVisible();
    expect(api.llamadas.some((l) => l.metodo === 'DELETE' && l.ruta === `/favorites/movie/${peli.tmdbId}`)).toBe(true);
  });

  test('cerrar sesión vuelve al login y bloquea las rutas', async ({ page, conSesion }) => {
    await page.goto('/favoritas');
    await expect(page.getByRole('heading', { name: /Tus/ })).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/favoritas');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('si el back responde 401, se avisa que la sesión venció', async ({ page, conSesion }) => {
    // Esta ruta se registra después, así que le gana al back de mentira
    await page.route('**/api/favorites', (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: CORS })
        : route.fulfill({
            status: 401,
            headers: CORS,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Token inválido' }),
          }),
    );
    await page.goto('/favoritas');
    await expect(page.getByRole('alert')).toContainText('Tu sesión venció');
  });
});