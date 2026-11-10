import { usePuntero } from '../../hooks/usePuntero.js';
import './fondo-vivo.css';

// Fondo de colores mezclados (mesh gradient) que se mueve lento.
// No es un fondo plano con manchas encima: toda la superficie es mezcla de la paleta.
// El cursor desplaza apenas la mezcla para que se sienta vivo.
export default function FondoVivo() {
  const { x, y } = usePuntero();

  return (
    <div className="fondo-vivo" aria-hidden="true">
      <div className="fondo-mezcla" style={{ translate: `${x * -18}px ${y * -14}px` }} />
      <div className="fondo-velo" />
    </div>
  );
}
