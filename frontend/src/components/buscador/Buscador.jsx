import { useId } from 'react';
import Mascota from '../mascota/Mascota.jsx';
import './buscador.css';

function IconoLupa() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M15.5 15.5 20 20" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

// Barra de búsqueda con la mascota chiquita asomada. Si no hay resultados, se tapa los ojos.
export default function Buscador({ valor, onCambio, onEnviar, etiqueta, placeholder, sinResultados = false }) {
  const id = useId();
  const escribiendo = valor.length > 0;

  return (
    <div
      className={`buscador${escribiendo ? ' escribiendo' : ''}${sinResultados ? ' sin-resultados' : ''}`}
      role="search"
    >
      <Mascota pose={sinResultados ? 'tapa' : 'frente'} className="buscador-mascota" />
      <label htmlFor={id} className="buscador-oculto">
        {etiqueta}
      </label>
      <span className="buscador-lupa">
        <IconoLupa />
      </span>
      <input
        id={id}
        type="search"
        className="buscador-campo"
        value={valor}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck="false"
        onChange={(e) => onCambio(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCambio('');
          if (e.key === 'Enter') onEnviar?.(valor);
        }}
      />
      {escribiendo && (
        <button type="button" className="buscador-limpiar" onClick={() => onCambio('')} aria-label="Borrar búsqueda">
          ×
        </button>
      )}
    </div>
  );
}
