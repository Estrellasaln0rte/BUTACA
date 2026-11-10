import { test, expect } from './fixtures.js';
import { E2E } from '../constantes.js';

test.describe('Llaves a salvo', () => {
  test('el navegador nunca llama a la API de TMDB ni recibe la key', async ({ page, conSesion }) => {
    const pedidos = [];
    const scripts = [];
    page.on('request', (req) => pedidos.push(req.url()));
    page.on('response', async (res) => {
      if (res.request().resourceType() === 'script') scripts.push({ url: res.url(), codigo: await res.text() });
    });

    // Recorre las pantallas que muestran pelis
    await page.goto('/');
    await page.getByRole('group', { name: /Elegí cómo te sentís/ }).getByRole('button', { name: 'Alegría' }).click();
    await expect(page.getByRole('heading', { name: 'La Gran Risa' })).toBeVisible();
    await page.getByRole('tab', { name: 'Series' }).click();
    await expect(page.getByRole('heading', { name: 'Oficina Divertida' })).toBeVisible();
    await page.getByRole('link', { name: 'Favoritas' }).click();
    await page.getByRole('link', { name: 'Tablero' }).click();
    await page.waitForLoadState('networkidle');

    // Las pelis salen de NUESTRO back; del navegador solo se piden los pósters (image.tmdb.org)
    expect(pedidos.filter((u) => u.includes('api.themoviedb.org'))).toEqual([]);
    expect(pedidos.some((u) => u.startsWith('https://image.tmdb.org/'))).toBe(true);
    expect(pedidos.some((u) => u.startsWith(`${E2E.apiUrl}/recommendations`))).toBe(true);

    // La key está en el entorno del proceso (ver playwright.config.js), pero no puede llegar a ningún JS
    expect(scripts.length).toBeGreaterThan(0);
    for (const { url, codigo } of scripts) {
      expect(codigo, `la key aparece en ${url}`).not.toContain(E2E.claveSecreta);
      expect(codigo, `TMDB_API_KEY aparece en ${url}`).not.toContain('TMDB_API_KEY');
      expect(codigo, `api_key aparece en ${url}`).not.toMatch(/api_key=/);
    }
  });

  test('el token de sesión solo viaja a nuestro back, nunca a terceros', async ({ page, conSesion }) => {
    const { token } = conSesion;
    const conToken = [];
    page.on('request', (req) => {
      if (req.headers().authorization?.includes(token)) conToken.push(req.url());
    });

    await page.goto('/');
    await page.getByRole('group', { name: /Elegí cómo te sentís/ }).getByRole('button', { name: 'Alegría' }).click();
    await expect(page.getByRole('heading', { name: 'La Gran Risa' })).toBeVisible();

    expect(conToken.length).toBeGreaterThan(0);
    for (const url of conToken) expect(url.startsWith(E2E.apiUrl), url).toBe(true);
  });
});