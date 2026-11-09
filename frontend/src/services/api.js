import { supabase } from './supabase.js';

const URL_API = import.meta.env.VITE_API_URL;

const MENSAJES_POR_ESTADO = {
  401: 'Tu sesión venció. Volvé a iniciar sesión.',
  429: 'Hiciste muchas solicitudes seguidas. Esperá un minuto y probá otra vez.',
  502: 'El catálogo de películas no responde. Probá de nuevo en un momento.',
};

async function pedirAlBackend(ruta, opciones = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const encabezados = { 'Content-Type': 'application/json' };
  if (token) encabezados.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, { ...opciones, headers: encabezados });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }

  if (respuesta.status === 204) return null;

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const error = new Error(
      MENSAJES_POR_ESTADO[respuesta.status] ?? cuerpo?.error ?? 'Algo salió mal, intentá de nuevo.',
    );
    error.estado = respuesta.status;
    throw error;
  }

  return cuerpo;
}

export function registrarAnimo(emocion, confianza) {
  return pedirAlBackend('/moods', {
    method: 'POST',
    body: JSON.stringify({ emotion: emocion, confidence: confianza }),
  });
}

export function obtenerAnimos(limite = 50) {
  return pedirAlBackend(`/moods?limit=${limite}`);
}

export function obtenerRecomendaciones(emocion, tipo, pagina) {
  const parametros = new URLSearchParams({ emotion: emocion, mediaType: tipo, page: pagina });
  return pedirAlBackend(`/recommendations?${parametros}`);
}

export function obtenerFavoritas() {
  return pedirAlBackend('/favorites');
}

export function agregarFavorita({ tmdbId, mediaType, title, posterPath }) {
  return pedirAlBackend('/favorites', {
    method: 'POST',
    body: JSON.stringify({ tmdbId, mediaType, title, posterPath }),
  });
}

export function quitarFavorita(mediaType, tmdbId) {
  return pedirAlBackend(`/favorites/${mediaType}/${tmdbId}`, { method: 'DELETE' });
}

export function obtenerTablero(dias) {
  return pedirAlBackend(`/dashboard?days=${dias}`);
}
