import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { obtenerTablero } from '../services/api.js';
import { ANIMOS, animoDeEmocion, aplicarAura } from '../utils/animos.js';
import FondoVivo from '../components/ui/FondoVivo.jsx';
import Mascota from '../components/mascota/Mascota.jsx';
import '../styles/recomendaciones.css';
import '../styles/tablero.css';

const RANGOS = [
  { dias: 7, nombre: '7 días' },
  { dias: 30, nombre: '30 días' },
  { dias: 90, nombre: '90 días' },
];

const TIPO_NOMBRE = { movie: 'Película', tv: 'Serie' };
const fechaCorta = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const fechaLarga = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });

// Fecha local "AAAA-MM-DD" para agrupar lecturas por día en la zona horaria de la persona.
function claveDia(fecha) {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resumir(lecturas, dias) {
  const porAnimo = new Map(ANIMOS.map((a) => [a.id, 0]));
  const porDia = new Map();

  for (const { emotion, at } of lecturas) {
    const animo = animoDeEmocion(emotion);
    porAnimo.set(animo.id, porAnimo.get(animo.id) + 1);
    const clave = claveDia(at);
    const dia = porDia.get(clave) ?? new Map();
    dia.set(animo.id, (dia.get(animo.id) ?? 0) + 1);
    porDia.set(clave, dia);
  }

  // Un casillero por día del rango, del más viejo al de hoy.
  const hoy = new Date();
  const casilleros = [];
  for (let i = dias - 1; i >= 0; i -= 1) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    const conteo = porDia.get(claveDia(fecha));
    let animo = null;
    let total = 0;
    if (conteo) {
      // El ánimo del día es el más leído; si empatan, el último de la lista de ANIMOS.
      let max = 0;
      for (const a of ANIMOS) {
        const n = conteo.get(a.id) ?? 0;
        total += n;
        if (n > 0 && n >= max) {
          max = n;
          animo = a;
        }
      }
    }
    casilleros.push({ fecha, animo, total });
  }

  const total = lecturas.length;
  const barras = ANIMOS.map((a) => ({ animo: a, cantidad: porAnimo.get(a.id) }));
  const principal = total ? barras.reduce((m, b) => (b.cantidad > m.cantidad ? b : m)) : null;
  return { total, barras, principal, casilleros };
}

export default function Tablero() {
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargar(rango) {
    setCargando(true);
    setError('');
    try {
      setDatos(await obtenerTablero(rango));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar(dias);
  }, [dias]);

  const resumen = useMemo(() => resumir(datos?.moodsOverTime ?? [], dias), [datos, dias]);
  const generos = (datos?.recommendedGenres ?? []).slice(0, 6);
  const maxGenero = generos[0]?.count ?? 1;
  const maxAnimo = Math.max(1, ...resumen.barras.map((b) => b.cantidad));
  const principal = resumen.principal?.animo;

  useEffect(() => {
    aplicarAura(principal ?? null);
    return () => aplicarAura(null);
  }, [principal]);

  const vacio = !cargando && !error && resumen.total === 0;

  return (
    <section className="recomendaciones tablero" aria-labelledby="titulo-tab" style={{ '--aura-rec': principal?.brillo ?? '#e0b4b2' }}>
      <FondoVivo />

      <div className="rec-contenido tab-contenido">
        <header className="rec-encabezado">
          <Mascota pose="frente" className="rec-mascota" />
          <h1 id="titulo-tab" className="rec-titulo">
            Tu <span className="rec-titulo-script">tablero</span>
          </h1>
          <div className="rec-controles">
            <div className="rec-pestanas" role="tablist" aria-label="Período">
              {RANGOS.map((r) => (
                <button
                  key={r.dias}
                  type="button"
                  role="tab"
                  aria-selected={dias === r.dias}
                  className={`rec-pestana${dias === r.dias ? ' activa' : ''}`}
                  onClick={() => setDias(r.dias)}
                >
                  {r.nombre}
                </button>
              ))}
            </div>
          </div>
        </header>

        {error ? (
          <div className="rec-estado" role="alert">
            <p>{error}</p>
            <button type="button" className="rec-boton" onClick={() => cargar(dias)}>
              Intentar de nuevo
            </button>
          </div>
        ) : vacio ? (
          <div className="rec-estado">
            <p>No hay lecturas en los últimos {dias} días. Cuando leas tu ánimo, tu tablero se va llenando.</p>
            <Link to="/" className="rec-boton fav-boton-enlace">
              Leer mi ánimo
            </Link>
          </div>
        ) : (
          <div className={`tab-grilla${cargando ? ' cargando' : ''}`} aria-busy={cargando}>
            {/* Dato principal */}
            <article className="tab-panel tab-destacado">
              <p className="tab-etiqueta">Lo que más sentiste</p>
              <p className="tab-numero">
                <span className="tab-muestra" style={{ background: principal?.grafico }} aria-hidden="true" />
                {principal?.nombre ?? '…'}
              </p>
              <p className="tab-nota">
                {resumen.principal?.cantidad ?? 0} de {resumen.total} {resumen.total === 1 ? 'lectura' : 'lecturas'} en{' '}
                {dias} días
              </p>
            </article>

            {/* Distribución por ánimo: barras horizontales, siempre en el mismo orden (el de ANIMOS) */}
            <article className="tab-panel tab-animos">
              <h2 className="tab-subtitulo">Cómo te sentiste</h2>
              <ul className="tab-barras">
                {resumen.barras.map(({ animo, cantidad }) => {
                  const pct = resumen.total ? Math.round((cantidad / resumen.total) * 100) : 0;
                  return (
                    <li key={animo.id} title={`${animo.nombre}: ${cantidad} ${cantidad === 1 ? 'lectura' : 'lecturas'} (${pct} %)`}>
                      <span className="tab-barra-nombre">{animo.nombre}</span>
                      <span className="tab-barra-pista">
                        <span
                          className="tab-barra"
                          style={{ width: `${(cantidad / maxAnimo) * 100}%`, background: animo.grafico }}
                        />
                      </span>
                      <span className="tab-barra-valor">
                        {cantidad} <small>{pct} %</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>

            {/* Día a día: un casillero por día, con el color del ánimo que más se leyó */}
            <article className="tab-panel tab-dias">
              <h2 className="tab-subtitulo">Día a día</h2>
              <ol className={`tab-calendario dias-${dias}`} aria-label={`Ánimo de cada día, últimos ${dias} días`}>
                {resumen.casilleros.map(({ fecha, animo, total }) => {
                  const texto = animo
                    ? `${fechaLarga.format(fecha)}: ${animo.nombre} (${total} ${total === 1 ? 'lectura' : 'lecturas'})`
                    : `${fechaLarga.format(fecha)}: sin lecturas`;
                  return (
                    <li
                      key={fecha.toISOString()}
                      className={`tab-dia${animo ? '' : ' vacio'}`}
                      style={animo ? { background: animo.grafico } : undefined}
                      title={texto}
                      aria-label={texto}
                      tabIndex={0}
                    />
                  );
                })}
              </ol>
              <div className="tab-eje" aria-hidden="true">
                <span>{fechaCorta.format(resumen.casilleros[0].fecha)}</span>
                <span>Hoy</span>
              </div>
              <ul className="tab-leyenda" aria-label="Colores">
                {ANIMOS.map((a) => (
                  <li key={a.id}>
                    <span className="tab-muestra chica" style={{ background: a.grafico }} aria-hidden="true" />
                    {a.nombre}
                  </li>
                ))}
                <li>
                  <span className="tab-muestra chica vacio" aria-hidden="true" />
                  Sin lectura
                </li>
              </ul>
            </article>

            {/* Géneros recomendados */}
            <article className="tab-panel tab-generos">
              <h2 className="tab-subtitulo">Géneros que más te recomendamos</h2>
              {generos.length === 0 ? (
                <p className="tab-nota">Todavía no pediste recomendaciones en este período.</p>
              ) : (
                <ul className="tab-barras">
                  {generos.map((g) => (
                    <li key={`${g.mediaType}-${g.id}`} title={`${g.name} (${TIPO_NOMBRE[g.mediaType]}): ${g.count}`}>
                      <span className="tab-barra-nombre">
                        {g.name}
                        <small>{TIPO_NOMBRE[g.mediaType] ?? g.mediaType}</small>
                      </span>
                      <span className="tab-barra-pista">
                        <span className="tab-barra genero" style={{ width: `${(g.count / maxGenero) * 100}%` }} />
                      </span>
                      <span className="tab-barra-valor">{g.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        )}
      </div>
    </section>
  );
}
