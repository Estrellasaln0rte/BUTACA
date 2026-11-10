import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { SesionProvider, useSesion } from './context/SesionContext.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import Login from './pages/Login.jsx';
import Detectar from './pages/Detectar.jsx';
import Recomendaciones from './pages/Recomendaciones.jsx';
import Favoritas from './pages/Favoritas.jsx';
import Tablero from './pages/Tablero.jsx';
import { useUltimaEmocion } from './hooks/useUltimaEmocion.js';

function BarraSesion() {
  const { usuario, cerrarSesion } = useSesion();
  const ultimaEmocion = useUltimaEmocion(usuario?.id);
  if (!usuario) return null;

  return (
    <header className="barra-sesion">
      <Link to="/" className="barra-sesion-marca">
        Butaca
      </Link>
      <nav className="barra-sesion-nav" aria-label="Secciones">
        <NavLink to="/" end aria-label="Leer ánimo">
          <span className="nav-largo">Leer ánimo</span>
          <span className="nav-corto">Leer</span>
        </NavLink>
        {ultimaEmocion && (
          <NavLink to={`/recomendaciones?emotion=${ultimaEmocion}`} aria-label="Recomendaciones">
            <span className="nav-largo">Recomendaciones</span>
            <span className="nav-corto">Películas</span>
          </NavLink>
        )}
        <NavLink to="/favoritas">Favoritas</NavLink>
        <NavLink to="/tablero">Tablero</NavLink>
      </nav>
      <span className="barra-sesion-usuario">{usuario.email}</span>
      <button type="button" className="barra-sesion-salir" onClick={cerrarSesion}>
        Cerrar sesión
      </button>
    </header>
  );
}

// Todas las pantallas, salvo el login, van envueltas en <RutaProtegida>.
// Recomendaciones aparece en el menú cuando ya hay un ánimo (el último que se usó).
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
            <Route
              path="/recomendaciones"
              element={
                <RutaProtegida>
                  <Recomendaciones />
                </RutaProtegida>
              }
            />
            <Route
              path="/favoritas"
              element={
                <RutaProtegida>
                  <Favoritas />
                </RutaProtegida>
              }
            />
            <Route
              path="/tablero"
              element={
                <RutaProtegida>
                  <Tablero />
                </RutaProtegida>
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
    </SesionProvider>
  );
}
