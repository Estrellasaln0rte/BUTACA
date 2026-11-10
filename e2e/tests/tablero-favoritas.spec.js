import { test, expect } from './fixtures.js';

// Hace N días a las 12:00 (hora local), para que caiga siempre en el casillero correcto
function haceDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

test.describe('Tablero', () => {
  test('muestra el ánimo en el tiempo y los géneros recomendados', async ({ page, conSesion }) => {
    const { api } = conSesion;
    api.tablero = {
      moodsOverTime: [
        { emotion: 'sad', at: haceDias(2) },
        { emotion: 'happy', at: haceDias(1) },
        { emotion: 'happy', at: haceDias(0) },
        { emotion: 'happy', at: haceDias(0) },
      ],
      recommendedGenres: [
        { id: 35, name: 'Comedia', mediaType: 'movie', count: 5 },
        { id: 18, name: 'Drama', mediaType: 'tv', count: 2 },
      ],
    };

    await page.goto('/tablero');
    await expect(page.getByRole('heading', { name: /Tu\s*tablero/ })).toBeVisible();

    // Lo que más sintió
    const destacado = page.locator('.tab-destacado');
    await expect(destacado).toContainText('Alegría');
    await expect(destacado).toContainText('3 de 4 lecturas en 30 días');

    // Día a día: hoy salió Alegría con 2 lecturas, y hay 30 casilleros
    const calendario = page.getByRole('list', { name: 'Ánimo de cada día, últimos 30 días' });
    await expect(calendario.getByRole('listitem')).toHaveCount(30);
    await expect(calendario.getByLabel(/Alegría \(2 lecturas\)/)).toHaveCount(1);
    await expect(calendario.getByLabel(/Tristeza \(1 lectura\)/)).toHaveCount(1);

    // Géneros recomendados
    const generos = page.locator('.tab-generos');
    await expect(generos).toContainText('Comedia');
    await expect(generos).toContainText('Drama');

    // Cambiar el período pide days=7
    await page.getByRole('tab', { name: '7 días' }).click();
    await expect(page.getByRole('list', { name: 'Ánimo de cada día, últimos 7 días' })).toBeVisible();
    expect(api.llamadas.filter((l) => l.ruta === '/dashboard').at(-1).query.get('days')).toBe('7');
  });

  test('sin lecturas muestra un estado vacío, no un error', async ({ page, conSesion }) => {
    await page.goto('/tablero');
    await expect(page.getByText('No hay lecturas en los últimos 30 días')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Leer mi ánimo' })).toBeVisible();
  });
});

const FAVORITAS = [
  {
    id: 'f101',
    tmdbId: 101,
    mediaType: 'movie',
    title: 'La Gran Risa',
    posterPath: null,
    createdAt: haceDias(3),
  },
  {
    id: 'f201',
    tmdbId: 201,
    mediaType: 'tv',
    title: 'Oficina Divertida',
    posterPath: null,
    createdAt: haceDias(1),
  },
];

test.describe('Favoritas', () => {
  test('los filtros separan películas y series', async ({ page, conSesion }) => {
    conSesion.api.favoritas = structuredClone(FAVORITAS);
    await page.goto('/favoritas');
    await expect(page.getByText('2 títulos guardados')).toBeVisible();

    await page.getByRole('tab', { name: 'Series' }).click();
    await expect(page.getByRole('heading', { name: 'Oficina Divertida' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'La Gran Risa' })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Películas' }).click();
    await expect(page.getByRole('heading', { name: 'La Gran Risa' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Oficina Divertida' })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Todas' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2);
  });

  test('"Deshacer" vuelve a guardar la favorita que quitaste', async ({ page, conSesion }) => {
    const { api } = conSesion;
    api.favoritas = structuredClone(FAVORITAS);
    await page.goto('/favoritas');

    await page.getByRole('button', { name: 'Quitar La Gran Risa de favoritas' }).click();
    await expect(page.getByText('Quitaste "La Gran Risa"')).toBeVisible();
    await expect(page.getByText('1 título guardado')).toBeVisible();

    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(page.getByRole('heading', { name: 'La Gran Risa' })).toBeVisible();
    await expect(page.getByText('2 títulos guardados')).toBeVisible();

    // Se volvió a guardar en el back, con el mismo payload estricto
    const alta = api.llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/favorites');
    expect(alta.cuerpo).toEqual({ tmdbId: 101, mediaType: 'movie', title: 'La Gran Risa', posterPath: null });
    expect(api.favoritas).toHaveLength(2);
  });

  test('guardar una que ya estaba (409) no muestra error', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/recomendaciones?emotion=happy');
    await expect(page.getByRole('heading', { name: 'La Gran Risa' })).toBeVisible();

    // Otra pestaña ya la guardó: el back responde 409 pero el corazón tiene que quedar lleno
    api.favoritas.push(structuredClone(FAVORITAS[0]));
    await page.getByRole('button', { name: 'Guardar La Gran Risa en favoritas' }).click();

    await expect(page.getByRole('button', { name: 'Quitar La Gran Risa de favoritas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.rec-aviso')).toHaveCount(0);
  });
});