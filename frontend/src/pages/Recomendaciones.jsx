import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { agregarFavorita, obtenerFavoritas, obtenerRecomendaciones, quitarFavorita } from '../services/api.js';
import { EMOCIONES } from '../utils/emociones.js';
import { animoDeEmocion, aplicarAura } from '../utils/animos.js';
import FondoVivo from '../components/ui/FondoVivo.jsx';
import Mascota from '../components/mascota/Mascota.jsx';
import '../styles/recomendaciones.css';

const TIPOS = [
  { id: 'movie', nombre: 'Películas' },
  { id: 'tv', nombre: 'Series' },
];

const URL_POSTER = 'https://image.tmdb.org/t/p/w342';

const claveFavorita = (tipo, tmdbId) => `${tipo}-${tmdbId}`;

function IconoCorazon({ lleno }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={lleno ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"
      />
    </svg>
  );
}

function Tarjeta({ item, tipo, esFavorita, onFavorita }) {
  const [abierta, setAbierta] = useState(false);
  const anio = item.releaseDate?.slice(0, 4);

  return (
    <li className={`rec-tarjeta${abierta ? ' abierta' : ''}`}>
      <button
        type="button"
        className="rec-poster"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        aria-label={`${item.title}: ${abierta ? 'ocultar' : 'ver'} sinopsis`}
      >
        {item.posterPath ? (
          <img src={`${URL_POSTER}${item.posterPath}`} alt="" loading="lazy" width="342" height="513" />
        ) : (
          <span className="rec-sin-poster" aria-hidden="true">{item.title}</span>
        )}
        <span className="rec-sinopsis">{item.overview || 'Sin sinopsis disponible.'}</span>
      </button>

      <button
        type="button"
        className={`rec-favorita${esFavorita ? ' activa' : ''}`}
        onClick={() => onFavorita(item, tipo)}
        aria-pressed={esFavorita}
        aria-label={esFavorita ? `Quitar ${item.title} de favoritas` : `Guardar ${item.title} en favoritas`}
      >
        <IconoCorazon lleno={esFavorita} />
      </button>

      <div className="rec-talon">
        <h3 className="rec-nombre">{item.title}</h3>
        <p className="rec-datos">
          {anio && <span>{anio}</span>}
          {item.rating != null && (
            <span className="rec-nota" aria-label={`Puntaje ${item.rating.toFixed(1)} de 10`}>
              ★ {item.rating.toFixed(1)}
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

function Esqueleto() {
  return (
    <li className="rec-tarjeta esqueleto" aria-hidden="true">
      <span className="rec-poster" />
      <div className="rec-talon">
        <span className="rec-linea" />
        <span className="rec-linea corta" />
      </div>
    </li>
  );
}

export default function Recomendaciones() {
  const [parametros, setParametros] = useSearchParams();
  const emocion = parametros.get('emotion');
  const tipo = parametros.get('tipo') === 'tv' ? 'tv' : 'movie';
  const valida = Object.hasOwn(EMOCIONES, emocion ?? '');
  const animo = animoDeEmocion(emocion);

  const [items, setItems] = useState([]);
  const [generos, setGeneros] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [favoritas, setFavoritas] = useState(() => new Set());
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!valida) return undefined;
    aplicarAura(animo);
    return () => aplicarAura(null);
  }, [valida, animo]);

  const cargar = useCallback(
    async (numero) => {
      setCargando(true);
      setError('');
      try {
        const datos = await obtenerRecomendaciones(emocion, tipo, numero);
        setGeneros(datos.genres ?? []);
        setTotalPaginas(Math.min(datos.totalPages ?? 1, 500));
        setPagina(numero);
        setItems((previos) => {
          if (numero === 1) return datos.items;
          const vistos = new Set(previos.map((i) => i.tmdbId));
          return [...previos, ...datos.items.filter((i) => !vistos.has(i.tmdbId))];
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    },
    [emocion, tipo],
  );

  useEffect(() => {
    if (!valida) return;
    setItems([]);
    cargar(1);
  }, [valida, cargar]);

  useEffect(() => {
    if (!valida) return;
    obtenerFavoritas()
      .then((datos) => setFavoritas(new Set(datos.items.map((f) => claveFavorita(f.mediaType, f.tmdbId)))))
      .catch(() => {
        // Sin la lista igual se puede navegar; el corazón arranca vacío.
      });
  }, [valida]);

  async function alternarFavorita(item, tipoItem) {
    const clave = claveFavorita(tipoItem, item.tmdbId);
    const yaEstaba = favoritas.has(clave);
    const cambiar = (agregar) =>
      setFavoritas((previas) => {
        const nuevas = new Set(previas);
        if (agregar) nuevas.add(clave);
        else nuevas.delete(clave);
        return nuevas;
      });

    cambiar(!yaEstaba);
    setAviso('');
    try {
      if (yaEstaba) await quitarFavorita(tipoItem, item.tmdbId);
      else
        await agregarFavorita({
          tmdbId: item.tmdbId,
          mediaType: tipoItem,
          title: item.title,
          posterPath: item.posterPath,
        });
    } catch (err) {
      // 409 = ya estaba guardada; 404 = ya no estaba. En ambos casos el estado nuevo es el correcto.
      if (err.estado === 409 || err.estado === 404) return;
      cambiar(yaEstaba);
      setAviso(`No pudimos ${yaEstaba ? 'quitar' : 'guardar'} "${item.title}". ${err.message}`);
    }
  }

  function cambiarTipo(nuevo) {
    if (nuevo === tipo) return;
    const siguientes = new URLSearchParams(parametros);
    if (nuevo === 'tv') siguientes.set('tipo', 'tv');
    else siguientes.delete('tipo');
    setParametros(siguientes, { replace: true });
  }

  if (!valida) return <Navigate to="/" replace />;

  const primeraCarga = cargando && items.length === 0;

  return (
    <section className="recomendaciones" aria-labelledby="titulo-rec" style={{ '--aura-rec': animo.brillo }}>
      <FondoVivo />

      <div className="rec-contenido">
        <header className="rec-encabezado">
          <Mascota pose="frente" className="rec-mascota" />
          <p className="rec-eyebrow">
            <span className="rec-punto" aria-hidden="true" />
            Tu ánimo: {animo.nombre}
          </p>
          <h1 id="titulo-rec" className="rec-titulo">
            Elegidas para tu <span className="rec-titulo-script">{animo.nombre.toLowerCase()}</span>
          </h1>
          {generos.length > 0 && (
            <ul className="rec-generos" aria-label="Géneros que usamos">
              {generos.map((g) => (
                <li key={g.id}>{g.name}</li>
              ))}
            </ul>
          )}

          <div className="rec-controles">
            <div className="rec-pestanas" role="tablist" aria-label="Tipo de contenido">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tipo === t.id}
                  className={`rec-pestana${tipo === t.id ? ' activa' : ''}`}
                  onClick={() => cambiarTipo(t.id)}
                >
                  {t.nombre}
                </button>
              ))}
            </div>
            <Link to="/" className="rec-enlace">
              Leer mi ánimo otra vez
            </Link>
          </div>
        </header>

        {aviso && (
          <p className="rec-aviso" role="status">
            {aviso}
          </p>
        )}

        {error && items.length === 0 ? (
          <div className="rec-estado" role="alert">
            <p>{error}</p>
            <button type="button" className="rec-boton" onClick={() => cargar(1)}>
              Intentar de nuevo
            </button>
          </div>
        ) : !cargando && items.length === 0 ? (
          <div className="rec-estado">
            <p>No encontramos títulos para este ánimo. Probá con {tipo === 'movie' ? 'series' : 'películas'}.</p>
          </div>
        ) : (
          <ul className="rec-grilla" aria-busy={cargando}>
            {items.map((item) => (
              <Tarjeta
                key={item.tmdbId}
                item={item}
                tipo={tipo}
                esFavorita={favoritas.has(claveFavorita(tipo, item.tmdbId))}
                onFavorita={alternarFavorita}
              />
            ))}
            {primeraCarga && Array.from({ length: 10 }, (_, i) => <Esqueleto key={i} />)}
          </ul>
        )}

        {items.length > 0 && (
          <div className="rec-pie">
            {error && <p className="rec-aviso">{error}</p>}
            {pagina < totalPaginas && (
              <button type="button" className="rec-boton" onClick={() => cargar(pagina + 1)} disabled={cargando}>
                {cargando ? 'Cargando…' : 'Ver más'}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
