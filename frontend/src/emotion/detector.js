// Detección de emoción con face-api.js (corre en el navegador: la imagen nunca sale de la compu).
// Los modelos viven en public/models y se cargan una sola vez.

const RUTA_MODELOS = '/models';
let promesaModelos = null;

async function cargarLibreria() {
  const faceapi = await import('@vladmandic/face-api');
  await faceapi.nets.tinyFaceDetector.loadFromUri(RUTA_MODELOS);
  await faceapi.nets.faceExpressionNet.loadFromUri(RUTA_MODELOS);
  return faceapi;
}

export function cargarModelos() {
  if (!promesaModelos) {
    promesaModelos = cargarLibreria().catch((error) => {
      promesaModelos = null;
      throw error;
    });
  }
  return promesaModelos;
}

function esperar(milisegundos) {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

// Mira la cara varias veces y promedia, para no decidir por un solo gesto.
// Devuelve { emocion, confianza } o null si casi nunca vio una cara.
export async function detectarEmocion(video, { muestras = 10, intervalo = 200 } = {}) {
  const faceapi = await cargarModelos();
  const opciones = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

  const sumas = {};
  let carasVistas = 0;

  for (let i = 0; i < muestras; i++) {
    const resultado = await faceapi.detectSingleFace(video, opciones).withFaceExpressions();
    if (resultado) {
      carasVistas++;
      Object.entries(resultado.expressions).forEach(([emocion, valor]) => {
        sumas[emocion] = (sumas[emocion] ?? 0) + valor;
      });
    }
    await esperar(intervalo);
  }

  if (carasVistas < muestras / 3) return null;

  let emocionGanadora = null;
  let mayorPromedio = 0;
  Object.entries(sumas).forEach(([emocion, suma]) => {
    const promedio = suma / carasVistas;
    if (promedio > mayorPromedio) {
      mayorPromedio = promedio;
      emocionGanadora = emocion;
    }
  });

  return { emocion: emocionGanadora, confianza: Math.round(mayorPromedio * 100) / 100 };
}
