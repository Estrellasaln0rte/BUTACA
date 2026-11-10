import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { agregarFavorita, obtenerFavoritas, quitarFavorita } from '../services/api.js';
import FondoVivo from '../components/ui/FondoVivo.jsx';
import Mascota from '../components/mascota/Mascota.jsx';
import '../styles/recomendaciones.css';
import '../styles/favoritas.css';

const FILTROS = [
  { id: 'todas', nombre: 'Todas' },
  { id: 'movie', nombre: 'Películas' },
  { id: 'tv', nombre: 'Series' },
];

const URL_POSTER = 'https://image.tmdb.org/t/p/w342';
const TIPO_NOMBRE = { movie: 'Película', tv: 'Serie' };
const fecha = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

function IconoCorazon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"
      />
    </svg>
  );
}

export default function Favoritas() {
  const [favoritas, setFavoritas] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [quitada, setQuitada] = useState(null); // { item, indice } para poder deshacer
  const [aviso, setAviso] = useState('');
  const temporizador = useRef(null);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const datos = await obtenerFavoritas();
      setFavoritas(datos.items ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    return () => clearTimeout(temporizador.current);
  }, []);

  async function quitar(item) {
    const indice = favoritas.findIndex((f) => f.id === item.id);
    setFavoritas((previas) => previas.filter((f) => f.id !== item.id));
    setAviso('');
    try {
      await quitarFavorita(item.mediaType, item.tmdbId);
      clearTimeout(temporizador.current);
      setQuitada({ item, indice });
      temporizador.current = setTimeout(() => setQuitada(null), 6000);
    } catch (err) {
      if (err.estado === 404) return; // ya no estaba: el estado nuevo es el correcto
      setFavoritas((previas) => {
        const nuevas = [...previas];
        nuevas.splice(indice, 0, item);
        return nuevas;
      });
      setAviso(`No pudimos quitar "${item.title}". ${err.message}`);
    }
  }

  async function deshacer() {
    if (!quitada) return;
    const { item, indice } = quitada;
    clearTimeout(temporizador.current);
    setQuitada(null);
    try {
      const nueva = await agregarFavorita({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        posterPath: item.posterPath,
      });
      setFavoritas((previas) => {
        const nuevas = [...previas];
        nuevas.splice(Math.min(indice, nuevas.length), 0, { ...item, ...nueva });
        return nuevas;
      });
    } catch (err) {
      setAviso(`No pudimos volver a guardar "${item.title}". ${err.message}`);
    }
  }

  const visibles = filtro === 'todas' ? favoritas : favoritas.filter((f) => f.mediaType === filtro);
  const vacia = !cargando && !error && favoritas.length === 0;

  return (
    <section className="recomendaciones favoritas" aria-labelledby="titulo-fav" style={{ '--aura-rec': '#ff7a93' }}>
      <FondoVivo />

      <div className="rec-contenido">
        <header className="rec-encabezado">
          <Mascota pose="frente" className="rec-mascota" />
          <h1 id="titulo-fav" className="rec-titulo">
            Tus <span className="rec-titulo-script">favoritas</span>
          </h1>
          {favoritas.length > 0 && (
            <p className="fav-cuenta">
              {favoritas.length} {favoritas.length === 1 ? 'título guardado' : 'títulos guardados'}
            </p>
          )}

          {favoritas.length > 0 && (
            <div className="rec-controles">
              <div className="rec-pestanas" role="tablist" aria-label="Filtrar por tipo">
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={filtro === f.id}
                    className={`rec-pestana${filtro === f.id ? ' activa' : ''}`}
                    onClick={() => setFiltro(f.id)}
                  >
                    {f.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {aviso && (
          <p className="rec-aviso" role="status">
            {aviso}
          </p>
        )}

        {error ? (
          <div className="rec-estado" role="alert">
            <p>{error}</p>
            <button type="button" className="rec-boton" onClick={cargar}>
              Intentar de nuevo
            </button>
          </div>
        ) : vacia ? (
          <div className="rec-estado">
            <p>Todavía no guardaste nada. Tocá el corazón en una recomendación y aparece acá.</p>
            <Link to="/" className="rec-boton fav-boton-enlace">
              Leer mi ánimo
            </Link>
          </div>
        ) : visibles.length === 0 && !cargando ? (
          <div className="rec-estado">
            <p>No tenés {filtro === 'movie' ? 'películas' : 'series'} guardadas.</p>
          </div>
        ) : (
          <ul className="rec-grilla" aria-busy={cargando}>
            {visibles.map((item) => (
              <li key={item.id} className="rec-tarjeta">
                <div className="rec-poster fav-poster">
                  {item.posterPath ? (
                    <img src={`${URL_POSTER}${item.posterPath}`} alt="" loading="lazy" width="342" height="513" />
                  ) : (
                    <span className="rec-sin-poster" aria-hidden="true">
                      {item.title}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="rec-favorita activa"
                  onClick={() => quitar(item)}
                  aria-label={`Quitar ${item.title} de favoritas`}
                  title="Quitar de favoritas"
                >
                  <IconoCorazon />
                </button>

                <div className="rec-talon">
                  <h2 className="rec-nombre">{item.title}</h2>
                  <p className="rec-datos">
                    <span className="fav-tipo">{TIPO_NOMBRE[item.mediaType] ?? item.mediaType}</span>
                    {item.createdAt && (
                      <span title="Fecha en que la guardaste">{fecha.format(new Date(item.createdAt))}</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
            {cargando &&
              favoritas.length === 0 &&
              Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="rec-tarjeta esqueleto" aria-hidden="true">
                  <span className="rec-poster" />
                  <div className="rec-talon">
                    <span className="rec-linea" />
                    <span className="rec-linea corta" />
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {quitada && (
        <div className="fav-deshacer" role="status">
          <span>Quitaste "{quitada.item.title}"</span>
          <button type="button" onClick={deshacer}>
            Deshacer
          </button>
        </div>
      )}
    </section>
  );
}
