import { useEffect, useState } from 'react';

// Posición del puntero normalizada de -1 a 1 respecto al centro de la ventana.
// Sirve para el parallax del fondo y para que la mascota siga el cursor con la mirada.
// En celulares usa la inclinación del dispositivo cuando el navegador la da sin pedir permiso.
export function usePuntero() {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducido) return undefined;

    let cuadro = 0;
    function actualizar(x, y) {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => setPos({ x, y }));
    }

    function alMover(e) {
      actualizar((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    }

    function alInclinar(e) {
      if (e.gamma == null || e.beta == null) return;
      const x = Math.max(-1, Math.min(1, e.gamma / 30));
      const y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      actualizar(x, y);
    }

    window.addEventListener('pointermove', alMover);
    window.addEventListener('deviceorientation', alInclinar);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('deviceorientation', alInclinar);
    };
  }, []);

  return pos;
}
