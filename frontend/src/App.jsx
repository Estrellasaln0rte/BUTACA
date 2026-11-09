import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SesionProvider, useSesion } from './context/SesionContext.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import Login from './pages/Login.jsx';
import Detectar from './pages/Detectar.jsx';

function BarraSesion() {
  const { usuario, cerrarSesion } = useSesion();
  if (!usuario) return null;

  return (
    <header className="barra-sesion">
      <span className="barra-sesion-marca">Butaca</span>
      <span className="barra-sesion-usuario">{usuario.email}</span>
      <button type="button" className="barra-sesion-salir" onClick={cerrarSesion}>
        Cerrar sesión
      </button>
    </header>
  );
}

// Front 1 agrega aquí la navegación y sus rutas (recomendaciones, favoritas, tablero),
// envueltas en <RutaProtegida> igual que "/".
export default function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <BarraSesion />
        <main>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RutaProtegida>
                  <Detectar />
                </RutaProtegida>
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
    </SesionProvider>
  );
}
