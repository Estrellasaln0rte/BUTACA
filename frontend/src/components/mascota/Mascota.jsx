import frente from '../../assets/mascota/mascota-frente.webp';
import tapa from '../../assets/mascota/mascota-tapa.webp';
import './mascota.css';

// La mascota de Butaca: imágenes fijas renderizadas en 3D.
// Las poses se generan con la herramienta de frontend/herramientas/render-mascota
// (se exporta un PNG transparente y se guarda en src/assets/mascota como WebP).
const POSES = {
  frente: { src: frente, alt: 'La mascota de Butaca' },
  tapa: { src: tapa, alt: 'La mascota de Butaca tapándose los ojos' },
};

export default function Mascota({ pose = 'frente', className = '' }) {
  const { src, alt } = POSES[pose] ?? POSES.frente;
  return (
    <img className={`mascota ${className}`} src={src} alt={alt} width="720" height="720" />
  );
}
