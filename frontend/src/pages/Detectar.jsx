import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { encenderCamara, apagarCamara } from '../emotion/camara.js';
import { cargarModelos, detectarEmocion } from '../emotion/detector.js';
import { registrarAnimo } from '../services/api.js';
import { ANIMOS, animoDeEmocion, aplicarAura } from '../utils/animos.js';
import FondoVivo from '../components/ui/FondoVivo.jsx';
import Mascota from '../components/mascota/Mascota.jsx';
import '../styles/deteccion.css';

function IconoEscudo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4z"
      />
    </svg>
  );
}

const PRIVACIDAD = [
  'Solo usamos la cámara para leer tu expresión, aquí en tu navegador.',
  'Tu imagen no se guarda ni se envía a ningún servidor.',
  'Lo único que guardamos es el ánimo que confirmes, para tu tablero.',
  'La cámara se apaga apenas termina la lectura.',
];

// pasos: 'permiso' → 'camara' → 'leyendo' → 'resultado'
export default function Detectar() {
  const navegar = useNavigate();
  const videoRef = useRef(null);
  const transmisionRef = useRef(null);

  const [paso, setPaso] = useState('permiso');
  const [modelosListos, setModelosListos] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [resultado, setResultado] = useState(null);
  const [indiceAnimo, setIndiceAnimo] = useState(() => ANIMOS.indexOf(animoDeEmocion('neutral')));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    return () => apagarCamara(transmisionRef.current, video);
  }, []);

  // El color del ánimo elegido tiñe la interfaz mientras se ve el resultado
  useEffect(() => {
    if (paso === 'resultado') aplicarAura(ANIMOS[indiceAnimo]);
  }, [paso, indiceAnimo]);

  function apagar() {
    apagarCamara(transmisionRef.current, videoRef.current);
    transmisionRef.current = null;
  }

  async function activarCamara() {
    setError('');
    setAviso('');
    setPaso('camara');
    aplicarAura(null);

    cargarModelos()
      .then(() => setModelosListos(true))
      .catch(() => setError('No se pudo cargar el detector de emociones. Recargá la página.'));

    try {
      transmisionRef.current = await encenderCamara(videoRef.current);
    } catch (e) {
      setError(e.message);
      setPaso('permiso');
    }
  }

  function cancelar() {
    apagar();
    setPaso('permiso');
  }

  async function leerAnimo() {
    setError('');
    setPaso('leyendo');

    let lectura;
    try {
      lectura = await detectarEmocion(videoRef.current);
    } catch {
      setError('Algo falló al leer tu cara. Probá otra vez.');
      setPaso('camara');
      return;
    }

    if (!lectura) {
      setError('No logramos ver tu cara. Acercate, buscá buena luz y mirá de frente a la cámara.');
      setPaso('camara');
      return;
    }

    apagar();
    setResultado(lectura);
    setIndiceAnimo(ANIMOS.indexOf(animoDeEmocion(lectura.emocion)));
    setPaso('resultado');
  }

  // Se guarda recién cuando la persona confirma: si no la cambió, la emoción detectada con su
  // confianza; si eligió otra, esa emoción sin confianza (no la midió la cámara).
  async function confirmarAnimo() {
    const animo = ANIMOS[indiceAnimo];
    const sinCorregir = animo === animoDeEmocion(resultado.emocion);
    const emocion = sinCorregir ? resultado.emocion : animo.emocion;

    if (aviso) {
      navegar(`/recomendaciones?emotion=${emocion}`);
      return;
    }

    setGuardando(true);
    try {
      await registrarAnimo(emocion, sinCorregir ? resultado.confianza : undefined);
      navegar(`/recomendaciones?emotion=${emocion}`);
    } catch (e) {
      setAviso(`Tu ánimo no se guardó en el historial: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  }

  // Sin cámara: la persona elige su ánimo a mano. Se guarda igual que una corrección (sin confianza)
  // y, si falla el guardado, igual se muestran las recomendaciones.
  async function elegirSinCamara(elegido) {
    setGuardando(true);
    try {
      await registrarAnimo(elegido.emocion);
    } catch {
      // El historial es secundario: no bloquea ver recomendaciones.
    } finally {
      setGuardando(false);
    }
    navegar(`/recomendaciones?emotion=${elegido.emocion}`);
  }

  const camaraVisible = paso === 'camara' || paso === 'leyendo';
  const animo = ANIMOS[indiceAnimo];

  return (
    <section className="deteccion" aria-labelledby="titulo-deteccion">
      <FondoVivo />

      <div className="det-escena" style={{ '--aura-det': paso === 'resultado' ? animo.brillo : '#e0b4b2' }}>
        {paso === 'permiso' && (
          <div className="det-permiso">
            <Mascota pose="tapa" className="det-mascota" />

            <div className="det-boleto">
              <h1 id="titulo-deteccion" className="det-titulo">
                ¿Cómo te sentís <span className="det-titulo-script">hoy?</span>
              </h1>
              <p className="det-texto">
                Para recomendarte algo acorde a tu ánimo necesitamos mirarte un par de segundos con la cámara.
              </p>

              <div className="det-perforado" aria-hidden="true" />

              <ul className="det-privacidad">
                {PRIVACIDAD.map((texto) => (
                  <li key={texto}>
                    <IconoEscudo />
                    {texto}
                  </li>
                ))}
              </ul>

              <button type="button" className="det-boton" onClick={activarCamara}>
                Permitir cámara y leer mi ánimo
              </button>
            </div>

            <div className="det-manual">
              <p id="det-manual-titulo">¿Preferís no usar la cámara? Elegí cómo te sentís:</p>
              <div className="det-manual-opciones" role="group" aria-labelledby="det-manual-titulo">
                {ANIMOS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="det-manual-opcion"
                    style={{ '--color-animo': a.brillo }}
                    onClick={() => elegirSinCamara(a)}
                    disabled={guardando}
                  >
                    <span className="det-manual-punto" aria-hidden="true" />
                    {a.nombre}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="det-camara" hidden={!camaraVisible}>
          {camaraVisible && (
            <h1 id="titulo-deteccion" className="det-titulo">
              {paso === 'leyendo' ? 'Leyendo tu ánimo…' : 'Mirá a la cámara'}
            </h1>
          )}

          <div className={paso === 'leyendo' ? 'det-lente leyendo' : 'det-lente'}>
            <div className="det-halo" aria-hidden="true" />
            <div className="det-marco">
              <video ref={videoRef} className="det-video" muted playsInline aria-label="Vista de tu cámara" />
            </div>
          </div>

          <p className="det-estado-camara">
            <span className="det-punto" aria-hidden="true" />
            Cámara encendida · tu foto no se guarda
          </p>

          <p className="det-texto" role="status">
            {paso === 'leyendo'
              ? 'Quedate quieto un momento.'
              : modelosListos
                ? 'Cuando estés listo, tocá el botón.'
                : 'Preparando el detector…'}
          </p>

          <div className="det-acciones">
            <button
              type="button"
              className="det-boton"
              disabled={!modelosListos || paso === 'leyendo'}
              onClick={leerAnimo}
            >
              Leer mi ánimo
            </button>
            <button type="button" className="det-boton secundario" disabled={paso === 'leyendo'} onClick={cancelar}>
              Apagar cámara
            </button>
          </div>
        </div>

        {paso === 'resultado' && resultado && (
          <div className="det-resultado">
            <div className="det-lente cerrado" aria-hidden="true">
              <div className="det-halo" />
              <div className="det-marco">
                <div className="det-iris" />
              </div>
            </div>
            <p className="det-estado-camara apagada">
              <span className="det-punto" aria-hidden="true" />
              Cámara apagada
            </p>

            <div className="det-panel">
              <h1 id="titulo-deteccion" className="det-titulo">
                {animo.frase}
              </h1>
              <p className="det-texto">
                Seguridad de la lectura: {Math.round(resultado.confianza * 100)} %. Si no es así, corregilo.
              </p>

              <fieldset className="det-slider">
                <legend>¿Así te sentís? Si no, elegí otra:</legend>
                <div className="det-slider-etiquetas">
                  {ANIMOS.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      className={i === indiceAnimo ? 'activa' : ''}
                      style={{ '--color-animo': a.brillo }}
                      aria-pressed={i === indiceAnimo}
                      onClick={() => {
                        setIndiceAnimo(i);
                        setAviso('');
                      }}
                    >
                      <span className="det-manual-punto" aria-hidden="true" />
                      {a.nombre}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="det-acciones">
                <button type="button" className="det-boton" disabled={guardando} onClick={confirmarAnimo}>
                  {guardando ? 'Guardando…' : aviso ? 'Ver recomendaciones igual' : 'Sí, ver recomendaciones'}
                </button>
                <button type="button" className="det-boton secundario" disabled={guardando} onClick={activarCamara}>
                  Leer otra vez
                </button>
              </div>

              {aviso && <p className="det-aviso">{aviso}</p>}
            </div>
          </div>
        )}

        {error && (
          <p className="det-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
