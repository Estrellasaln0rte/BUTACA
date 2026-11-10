import { Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../context/SesionContext.jsx';

export default function RutaProtegida({ children }) {
  const { sesion, cargandoSesion } = useSesion();
  const ubicacion = useLocation();

  if (cargandoSesion) {
    return (
      <p className="acceso-mensaje" role="status">
        Revisando tu sesión…
      </p>
    );
  }

  if (!sesion) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  }

  return children;
}
