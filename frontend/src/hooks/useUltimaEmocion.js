import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { obtenerAnimos } from '../services/api.js';
import { EMOCIONES } from '../utils/emociones.js';

// Recuerda la última emoción con la que la persona vio recomendaciones, para poder volver
// desde el menú sin leer el ánimo otra vez. Se guarda en este navegador (por usuario);
// si no hay nada guardado, se usa el último ánimo de su historial en el back.
const clave = (usuarioId) => `butaca:ultima-emocion:${usuarioId}`;
const esValida = (emocion) => Boolean(emocion) && Object.hasOwn(EMOCIONES, emocion);

export function guardarUltimaEmocion(usuarioId, emocion) {
  if (!usuarioId || !esValida(emocion)) return;
  try {
    localStorage.setItem(clave(usuarioId), emocion);
  } catch {
    // Navegación privada o almacenamiento bloqueado: el menú cae al historial del back.
  }
}

function leerGuardada(usuarioId) {
  try {
    const emocion = localStorage.getItem(clave(usuarioId));
    return esValida(emocion) ? emocion : null;
  } catch {
    return null;
  }
}

export function useUltimaEmocion(usuarioId) {
  const { pathname, search } = useLocation();
  const [delHistorial, setDelHistorial] = useState(null);
  const guardada = usuarioId ? leerGuardada(usuarioId) : null;

  useEffect(() => {
    if (!usuarioId || guardada) return undefined;
    let vigente = true;
    obtenerAnimos(1)
      .then((datos) => {
        const ultima = datos?.items?.at(-1)?.emotion;
        if (vigente && esValida(ultima)) setDelHistorial(ultima);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
    // pathname y search: se vuelve a mirar al navegar, por si se guardó un ánimo nuevo.
  }, [usuarioId, guardada, pathname, search]);

  return guardada ?? delHistorial;
}
