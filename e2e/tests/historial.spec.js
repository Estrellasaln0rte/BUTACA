import { test, expect } from './fixtures.js';

// El tablero solo debería contar lo que la persona sintió, no cada vez que explora.
// El front manda history=true únicamente en la primera carga que viene de Detectar.
const pedidos = (api) => api.llamadas.filter((l) => l.ruta === '/recommendations');
const conHistorial = (api) => pedidos(api).filter((l) => l.query.get('history') === 'true');

async function elegirAnimo(page, nombre) {
  await page.goto('/');
  await page.getByRole('group', { name: /Elegí cómo te sentís/ }).getByRole('button', { name: nombre }).click();
  await expect(page.getByRole('heading', { name: 'La Gran Risa' })).toBeVisible();
}

test.describe('Historial de recomendaciones (history)', () => {
  test('solo la primera carga después de leer el ánimo va al historial', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await elegirAnimo(page, 'Alegría');

    expect(conHistorial(api)).toHaveLength(1);
    expect(conHistorial(api)[0].query.get('emotion')).toBe('happy');
    expect(conHistorial(api)[0].query.get('page')).toBe('1');
  });

  test('explorar no suma al historial: Ver más, Series, otro ánimo', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await elegirAnimo(page, 'Alegría');
    const antes = pedidos(api).length;

    await page.getByRole('button', { name: 'Ver más' }).click();
    await expect(page.getByRole('heading', { name: 'Risas en el Camino' })).toBeVisible();
    await page.getByRole('tab', { name: 'Series' }).click();
    await expect(page.getByRole('heading', { name: 'Oficina Divertida' })).toBeVisible();
    await page
      .getByRole('group', { name: 'Ver recomendaciones para otro ánimo' })
      .getByRole('button', { name: 'Enojo' })
      .click();
    await expect(page).toHaveURL(/emotion=angry/);
    // La grilla ya mostraba esa serie: hay que esperar a que salga el pedido nuevo
    await expect.poll(() => pedidos(api).some((l) => l.query.get('emotion') === 'angry')).toBe(true);

    const explorando = pedidos(api).slice(antes);
    expect(explorando.length).toBeGreaterThanOrEqual(3);
    for (const l of explorando) expect(l.query.get('history'), l.query.toString()).toBe('false');
    expect(conHistorial(api)).toHaveLength(1); // solo la de la lectura
  });

  test('recargar la página no lo vuelve a guardar', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await elegirAnimo(page, 'Alegría');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'La Gran Risa' })).toBeVisible();

    expect(conHistorial(api)).toHaveLength(1);
  });

  test('entrar directo por la URL o desde el menú no va al historial', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/recomendaciones?emotion=sad');
    await expect(page.getByRole('heading', { name: 'La Gran Risa' })).toBeVisible();
    await page.getByRole('link', { name: 'Favoritas' }).click();
    await page.getByRole('link', { name: 'Recomendaciones' }).click();
    await expect(page.getByRole('heading', { name: 'La Gran Risa' })).toBeVisible();

    expect(pedidos(api).length).toBeGreaterThan(0);
    expect(conHistorial(api)).toHaveLength(0);
  });
});