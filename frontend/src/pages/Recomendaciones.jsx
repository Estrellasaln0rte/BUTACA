import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  agregarFavorita,
  buscarTitulos,
  obtenerFavoritas,
  obtenerRecomendaciones,
  quitarFavorita,
} from '../services/api.js';
import { EMOCIONES } from '../utils/emociones.js';
import { ANIMOS, animoDeEmocion, aplicarAura } from '../utils/animos.js';
import FondoVivo from '../components/ui/FondoVivo.jsx';
import { useSesion } from '../context/SesionContext.jsx';
import { guardarUltimaEmocion } from '../hooks/useUltimaEmocion.js';
import Mascota from '../components/mascota/Mascota.jsx';
import Buscador from '../components/buscador/Buscador.jsx';
import '../styles/recomendaciones.css';

const TIPOS = [
  { id: 'movie', nombre: 'Películas' },
  { id: 'tv', nombre: 'Series' },
];

const URL_POSTER = 'https://image.tmdb.org/t/p/w342';

// Espera a que la persona deje de escribir antes de buscar (el back permite 30 búsquedas por minuto).
const ESPERA_BUSQUEDA = 500;

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
  const [hayMas, setHayMas] = useState(false);
  const [hayArriba, setHayArriba] = useState(false);
  const sinopsisRef = useRef(null);
  const idSinopsis = useId();
  const anio = item.releaseDate?.slice(0, 4);

  // Desvanece arriba y abajo solo donde hay texto escondido: abajo avisa que se puede seguir leyendo,
  // arriba evita que el texto scrolleado choque con el corazón.
  const medir = useCallback(() => {
    const el = sinopsisRef.current;
    if (!el) return;
    setHayMas(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    setHayArriba(el.scrollTop > 4);
  }, []);

  useLayoutEffect(() => {
    if (abierta) medir();
    else if (sinopsisRef.current) sinopsisRef.current.scrollTop = 0;
  }, [abierta, medir]);

  return (
    <li className={`rec-tarjeta${abierta ? ' abierta' : ''}`}>
      <div className="rec-poster" onMouseEnter={medir}>
        <button
          type="button"
          className="rec-poster-boton"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          aria-controls={idSinopsis}
          aria-label={`${item.title}: ${abierta ? 'ocultar' : 'ver'} sinopsis`}
        >
          {item.posterPath ? (
            <img src={`${URL_POSTER}${item.posterPath}`} alt="" loading="lazy" width="342" height="513" />
          ) : (
            <span className="rec-sin-poster" aria-hidden="true">{item.title}</span>
          )}
        </button>
        {/* Va fuera del botón para que se pueda scrollear con el dedo, la rueda o el teclado.
            Tocarla sin arrastrar la cierra, igual que tocar el póster. */}
        <div
          id={idSinopsis}
          ref={sinopsisRef}
          className={`rec-sinopsis${hayMas ? ' hay-mas' : ''}${hayArriba ? ' hay-arriba' : ''}`}
          role="region"
          aria-label={`Sinopsis de ${item.title}`}
          tabIndex={abierta ? 0 : -1}
          onScroll={medir}
          onClick={() => setAbierta(false)}
        >
          <p className="rec-sinopsis-texto">{item.overview || 'Sin sinopsis disponible.'}</p>
        </div>
      </div>

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

  // Búsqueda por título en todo TMDB: mientras haya texto, la grilla muestra resultados en vez de recomendaciones.
  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState([]);
  const [paginaBusqueda, setPaginaBusqueda] = useState(1);
  const [totalBusqueda, setTotalBusqueda] = useState(1);
  const [buscandoAhora, setBuscandoAhora] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const ultimaBusqueda = useRef(0);

  const { usuario } = useSesion();

  // Solo la primera carga que viene de Detectar va al historial del tablero (history=true).
  // Se lee una vez al montar y después se borra ese aviso: así recargar o volver atrás no lo repite.
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const historialPendiente = useRef(ubicacion.state?.desdeDeteccion === true);

  useEffect(() => {
    if (ubicacion.state?.desdeDeteccion) navegar({ search: ubicacion.search }, { replace: true, state: null });
  }, [ubicacion.state, ubicacion.search, navegar]);

  useEffect(() => {
    if (valida) guardarUltimaEmocion(usuario?.id, emocion);
  }, [valida, usuario?.id, emocion]);

  useEffect(() => {
    if (!valida) return undefined;
    aplicarAura(animo);
    return () => aplicarAura(null);
  }, [valida, animo]);

  const cargar = useCallback(
    async (numero) => {
      setCargando(true);
      setError('');
      const guardarEnHistorial = numero === 1 && historialPendiente.current;
      historialPendiente.current = false;
      try {
        const datos = await obtenerRecomendaciones(emocion, tipo, numero, guardarEnHistorial);
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
    const limpio = texto.trim();
    const espera = setTimeout(() => setConsulta(limpio), limpio ? ESPERA_BUSQUEDA : 0);
    return () => clearTimeout(espera);
  }, [texto]);

  const buscar = useCallback(
    async (numero) => {
      if (!consulta) return;
      const id = ++ultimaBusqueda.current;
      setBuscandoAhora(true);
      setErrorBusqueda('');
      try {
        const datos = await buscarTitulos(consulta, tipo, numero);
        if (id !== ultimaBusqueda.current) return; // llegó tarde: ya se buscó otra cosa
        setTotalBusqueda(Math.min(datos.totalPages ?? 1, 500));
        setPaginaBusqueda(numero);
        setResultados((previos) => {
          if (numero === 1) return datos.items;
          const vistos = new Set(previos.map((i) => i.tmdbId));
          return [...previos, ...datos.items.filter((i) => !vistos.has(i.tmdbId))];
        });
      } catch (err) {
        if (id === ultimaBusqueda.current) setErrorBusqueda(err.message);
      } finally {
        if (id === ultimaBusqueda.current) setBuscandoAhora(false);
      }
    },
    [consulta, tipo],
  );

  useEffect(() => {
    setResultados([]);
    if (!consulta) {
      ultimaBusqueda.current += 1;
      setBuscandoAhora(false);
      setErrorBusqueda('');
      return;
    }
    buscar(1);
  }, [consulta, buscar]);

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

  // Explorar otro ánimo desde acá no se guarda en el historial: solo cambia lo que se muestra.
  function cambiarAnimo(nuevo) {
    if (nuevo.id === animo.id) return;
    const siguientes = new URLSearchParams(parametros);
    siguientes.set('emotion', nuevo.emocion);
    setParametros(siguientes);
  }

  if (!valida) return <Navigate to="/" replace />;

  // Con texto escrito se muestra la búsqueda; mientras espera a que termines de escribir, ya cuenta como búsqueda.
  const enBusqueda = texto.trim() !== '';
  const lista = enBusqueda ? resultados : items;
  const ocupado = enBusqueda ? buscandoAhora || consulta !== texto.trim() : cargando;
  const fallo = enBusqueda ? errorBusqueda : error;
  const paginaActual = enBusqueda ? paginaBusqueda : pagina;
  const paginas = enBusqueda ? totalBusqueda : totalPaginas;
  const primeraCarga = ocupado && lista.length === 0;
  const sinResultados = enBusqueda && !ocupado && !errorBusqueda && resultados.length === 0;
  const nombreTipo = tipo === 'movie' ? 'películas' : 'series';
  const otroTipo = tipo === 'movie' ? 'series' : 'películas';
  const reintentar = () => (enBusqueda ? buscar(1) : cargar(1));
  const verMas = () => (enBusqueda ? buscar(paginaActual + 1) : cargar(paginaActual + 1));

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

          <Buscador
            valor={texto}
            onCambio={setTexto}
            onEnviar={(v) => setConsulta(v.trim())}
            etiqueta="Buscar películas o series por título"
            placeholder={`Buscar ${nombreTipo} por título…`}
            sinResultados={sinResultados}
          />

          <div className="rec-animos" role="group" aria-label="Ver recomendaciones para otro ánimo">
            <span className="rec-animos-titulo">Ver para otro ánimo:</span>
            {ANIMOS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`rec-animo${a.id === animo.id ? ' activo' : ''}`}
                style={{ '--color-animo': a.brillo }}
                aria-pressed={a.id === animo.id}
                onClick={() => cambiarAnimo(a)}
              >
                <span className="rec-animo-punto" aria-hidden="true" />
                {a.nombre}
              </button>
            ))}
          </div>
        </header>

        {aviso && (
          <p className="rec-aviso" role="status">
            {aviso}
          </p>
        )}

        {enBusqueda && (
          <p className="rec-resultados" role="status">
            {ocupado && lista.length === 0
              ? `Buscando “${texto.trim()}”…`
              : sinResultados
                ? ''
                : `Resultados para “${consulta}” en ${nombreTipo}`}
          </p>
        )}

        {fallo && lista.length === 0 ? (
          <div className="rec-estado" role="alert">
            <p>{fallo}</p>
            <button type="button" className="rec-boton" onClick={reintentar}>
              Intentar de nuevo
            </button>
          </div>
        ) : sinResultados ? (
          <div className="rec-estado">
            <p>
              No encontramos “{consulta}” en {nombreTipo}. Probá con {otroTipo} o con otro título.
            </p>
            <button type="button" className="rec-boton" onClick={() => setTexto('')}>
              Borrar búsqueda
            </button>
          </div>
        ) : !ocupado && lista.length === 0 ? (
          <div className="rec-estado">
            <p>No encontramos títulos para este ánimo. Probá con {otroTipo}.</p>
          </div>
        ) : (
          <ul className="rec-grilla" aria-busy={ocupado}>
            {lista.map((item) => (
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

        {lista.length > 0 && (
          <div className="rec-pie">
            {fallo && <p className="rec-aviso">{fallo}</p>}
            {paginaActual < paginas && (
              <button type="button" className="rec-boton" onClick={verMas} disabled={ocupado}>
                {ocupado ? 'Cargando…' : 'Ver más'}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
