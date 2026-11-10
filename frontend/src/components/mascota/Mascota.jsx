import frente from '../../assets/mascota/mascota-frente.webp';
import './mascota.css';

// La mascota de Butaca: una imagen fija renderizada en 3D.
// Las poses se generan con la herramienta de frontend/herramientas/render-mascota
// (se exporta un PNG transparente y se guarda en src/assets/mascota).
const POSES = {
  frente,
};

export default function Mascota({ pose = 'frente', className = '' }) {
  return (
    <img
      className={`mascota ${className}`}
      src={POSES[pose] ?? POSES.frente}
      alt="La mascota de Butaca"
      width="720"
      height="720"
      decoding="async"
    />
  );
}
