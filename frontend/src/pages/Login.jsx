import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../context/SesionContext.jsx';

const PROVEEDORES = [
  { id: 'google', nombre: 'Google' },
  { id: 'github', nombre: 'GitHub' },
];

export default function Login() {
  const { sesion, iniciarSesion } = useSesion();
  const ubicacion = useLocation();
  const [proveedorElegido, setProveedorElegido] = useState(null);
  const [error, setError] = useState('');

  if (sesion) {
    return <Navigate to={ubicacion.state?.desde ?? '/'} replace />;
  }

  async function entrarCon(proveedor) {
    setProveedorElegido(proveedor.id);
    setError('');
    const { error: errorSupabase } = await iniciarSesion(proveedor.id);
    if (errorSupabase) {
      setError(`No se pudo abrir el inicio de sesión con ${proveedor.nombre}. Intentá de nuevo.`);
      setProveedorElegido(null);
    }
  }

  return (
    <section className="acceso">
      <div className="acceso-tarjeta">
        <h1 className="acceso-titulo">Butaca</h1>
        <p className="acceso-texto">
          Te leemos el ánimo con la cámara y te decimos qué ver esta noche. Entrá con tu cuenta para guardar
          tus favoritas y tu historial.
        </p>

        <div className="acceso-botones">
          {PROVEEDORES.map((proveedor) => (
            <button
              key={proveedor.id}
              type="button"
              className={`boton-proveedor boton-${proveedor.id}`}
              disabled={proveedorElegido !== null}
              onClick={() => entrarCon(proveedor)}
            >
              {proveedorElegido === proveedor.id ? 'Abriendo…' : `Continuar con ${proveedor.nombre}`}
            </button>
          ))}
        </div>

        {error && (
          <p className="acceso-error" role="alert">
            {error}
          </p>
        )}

        <p className="acceso-nota">No creás otra contraseña: usamos tu cuenta de Google o GitHub.</p>
      </div>
    </section>
  );
}
