import { test, expect } from './fixtures.js';

// Chromium con una cámara falsa (un patrón de colores, no una cara) y el permiso ya dado.
// Así se prueba el flujo de la cámara sin una cámara de verdad, también en el CI.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

// Espía la cámara y el canvas desde antes de que cargue la app:
// - cuántas veces se pidió la cámara y qué transmisiones se abrieron (para ver si se apagan)
// - si alguien intentó convertir un frame en imagen (toDataURL / toBlob)
async function espiarCamara(page) {
  await page.addInitScript(() => {
    window.__e2e = { pedidosCamara: 0, transmisiones: [], fotos: 0 };
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => {
      window.__e2e.pedidosCamara += 1;
      const transmision = await original(...args);
      window.__e2e.transmisiones.push(transmision);
      return transmision;
    };
    for (const metodo of ['toDataURL', 'toBlob']) {
      const real = HTMLCanvasElement.prototype[metodo];
      HTMLCanvasElement.prototype[metodo] = function (...args) {
        window.__e2e.fotos += 1;
        return real.apply(this, args);
      };
    }
  });
}

const espia = (page) =>
  page.evaluate(() => ({
    pedidosCamara: window.__e2e.pedidosCamara,
    fotos: window.__e2e.fotos,
    pistasVivas: window.__e2e.transmisiones.flatMap((t) => t.getTracks()).filter((p) => p.readyState === 'live')
      .length,
  }));

test.describe('Cámara y privacidad', () => {
  test('pide permiso y explica para qué antes de encender la cámara', async ({ page, conSesion }) => {
    await espiarCamara(page);
    await page.goto('/');

    await expect(page.getByText('Tu imagen no se guarda ni se envía a ningún servidor.')).toBeVisible();
    await expect(page.getByText('La cámara se apaga apenas termina la lectura.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Permitir cámara y leer mi ánimo' })).toBeVisible();

    // Solo con abrir la página, la cámara no se toca
    expect((await espia(page)).pedidosCamara).toBe(0);
  });

  test('enciende la cámara, la apaga, y nunca saca ni manda una foto', async ({ page, conSesion }) => {
    test.slow(); // carga los modelos de face-api y hace 10 lecturas: necesita más tiempo
    const { api } = conSesion;
    const cuerpos = [];
    page.on('request', (req) => {
      if (req.postData()) cuerpos.push({ url: req.url(), cuerpo: req.postData() });
    });

    await espiarCamara(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Permitir cámara y leer mi ánimo' }).click();

    await expect(page.getByRole('heading', { name: 'Mirá a la cámara' })).toBeVisible();
    await expect(page.getByText('Cámara encendida · tu foto no se guarda')).toBeVisible();
    expect((await espia(page)).pedidosCamara).toBe(1);
    // getUserMedia tarda un momento en entregar la transmisión: reintenta hasta que esté viva
    await expect.poll(async () => (await espia(page)).pistasVivas).toBeGreaterThan(0);

    // La cámara falsa no muestra una cara: la app tiene que decirlo, no inventar una emoción
    const leer = page.getByRole('button', { name: 'Leer mi ánimo', exact: true });
    await expect(leer).toBeEnabled({ timeout: 30_000 }); // espera a que carguen los modelos
    await leer.click();
    await expect(page.getByRole('alert')).toContainText('No logramos ver tu cara', { timeout: 30_000 });

    // Apagar la cámara corta la transmisión de verdad (no solo la oculta)
    await page.getByRole('button', { name: 'Apagar cámara' }).click();
    await expect(page.getByRole('button', { name: 'Permitir cámara y leer mi ánimo' })).toBeVisible();
    expect((await espia(page)).pistasVivas).toBe(0);

    // Nadie convirtió un frame en imagen, ningún request llevó una imagen, y al back no llegó nada
    expect((await espia(page)).fotos).toBe(0);
    for (const { url, cuerpo } of cuerpos) {
      expect(cuerpo, `request con imagen a ${url}`).not.toMatch(/data:image|base64|image\/(jpeg|png|webp)/i);
    }
    expect(api.llamadas.filter((l) => l.metodo === 'POST')).toHaveLength(0);
  });

  test('salir de la página apaga la cámara', async ({ page, conSesion }) => {
    await espiarCamara(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Permitir cámara y leer mi ánimo' }).click();
    await expect(page.getByText('Cámara encendida · tu foto no se guarda')).toBeVisible();
    await expect.poll(async () => (await espia(page)).pistasVivas).toBeGreaterThan(0);

    await page.getByRole('link', { name: 'Favoritas' }).click();
    await expect(page).toHaveURL(/\/favoritas$/);
    await expect.poll(async () => (await espia(page)).pistasVivas).toBe(0);
  });

  test('el ánimo elegido sin cámara llega al back solo como etiqueta', async ({ page, conSesion }) => {
    const { api } = conSesion;
    await page.goto('/');
    await page.getByRole('group', { name: /Elegí cómo te sentís/ }).getByRole('button', { name: 'Tristeza' }).click();
    await expect(page).toHaveURL(/emotion=sad/);

    const posts = api.llamadas.filter((l) => l.metodo === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ ruta: '/moods', cuerpo: { emotion: 'sad' } });
  });
});