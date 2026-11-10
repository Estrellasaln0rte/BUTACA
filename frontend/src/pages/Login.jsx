import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../context/SesionContext.jsx';
import FondoVivo from '../components/ui/FondoVivo.jsx';
import Mascota from '../components/mascota/Mascota.jsx';
import '../styles/login.css';

function IconoGoogle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
    </svg>
  );
}

function IconoGitHub() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z"
      />
    </svg>
  );
}

const PROVEEDORES = [
  { id: 'google', nombre: 'Google', Icono: IconoGoogle },
  { id: 'github', nombre: 'GitHub', Icono: IconoGitHub },
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
    <section className="login">
      <FondoVivo />

      <div className="login-escena">
        <Mascota pose="frente" className="login-mascota" />

        <div className="login-panel">
          <span className="login-marca">Butaca</span>

          <h1 className="login-titulo">
            <span className="login-titulo-grande">Tu noche</span>
            <span className="login-titulo-script">de cine</span>
          </h1>

          <p className="login-texto">
            Te leemos el ánimo con la cámara y te decimos qué ver esta noche. Entrá con tu cuenta para guardar tus
            favoritas y tu historial.
          </p>

          <div className="login-botones">
            {PROVEEDORES.map((proveedor) => (
              <button
                key={proveedor.id}
                type="button"
                className={`boleto boleto--${proveedor.id}`}
                disabled={proveedorElegido !== null}
                onClick={() => entrarCon(proveedor)}
              >
                <span className="boleto-cara">
                  <span className="boleto-talon">
                    <proveedor.Icono />
                  </span>
                  <span className="boleto-texto">
                    {proveedorElegido === proveedor.id ? 'Abriendo…' : `Continuar con ${proveedor.nombre}`}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <p className="login-insignia">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4z"
              />
            </svg>
            Tu foto nunca se guarda
          </p>
        </div>
      </div>
    </section>
  );
}
