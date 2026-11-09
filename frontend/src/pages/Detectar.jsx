import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { encenderCamara, apagarCamara } from '../emotion/camara.js';
import { cargarModelos, detectarEmocion } from '../emotion/detector.js';
import { registrarAnimo } from '../services/api.js';
import { EMOCIONES } from '../utils/emociones.js';

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

  useEffect(() => {
    const video = videoRef.current;
    return () => apagarCamara(transmisionRef.current, video);
  }, []);

  function apagar() {
    apagarCamara(transmisionRef.current, videoRef.current);
    transmisionRef.current = null;
  }

  async function activarCamara() {
    setError('');
    setAviso('');
    setPaso('camara');

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
    setPaso('resultado');

    try {
      await registrarAnimo(lectura.emocion, lectura.confianza);
    } catch (e) {
      setAviso(`Tu ánimo no se guardó en el historial: ${e.message}`);
    }
  }

  function verRecomendaciones() {
    navegar(`/recomendaciones?emotion=${resultado.emocion}`);
  }

  const camaraVisible = paso === 'camara' || paso === 'leyendo';
  const datosEmocion = resultado ? EMOCIONES[resultado.emocion] : null;

  return (
    <section className="deteccion" aria-labelledby="titulo-deteccion">
      {paso === 'permiso' && (
        <div className="deteccion-permiso">
          <h1 id="titulo-deteccion" className="deteccion-titulo">
            ¿Cómo te sentís hoy?
          </h1>
          <p className="deteccion-texto">
            Para recomendarte algo acorde a tu ánimo necesitamos mirarte un par de segundos con la cámara.
          </p>

          <ul className="deteccion-privacidad">
            <li>Solo usamos la cámara para leer tu expresión, aquí en tu navegador.</li>
            <li>Tu imagen no se guarda ni se envía a ningún servidor.</li>
            <li>Lo único que guardamos es la emoción detectada, para tu tablero.</li>
            <li>La cámara se apaga apenas termina la lectura.</li>
          </ul>

          <button type="button" className="deteccion-boton" onClick={activarCamara}>
            Permitir cámara y leer mi ánimo
          </button>
        </div>
      )}

      <div className="deteccion-camara" hidden={!camaraVisible}>
        {camaraVisible && (
          <h1 id="titulo-deteccion" className="deteccion-titulo">
            {paso === 'leyendo' ? 'Leyendo tu ánimo…' : 'Mirá a la cámara'}
          </h1>
        )}

        <div className={paso === 'leyendo' ? 'deteccion-marco leyendo' : 'deteccion-marco'}>
          <video ref={videoRef} className="deteccion-video" muted playsInline aria-label="Vista de tu cámara" />
        </div>

        <p className="deteccion-texto" role="status">
          {paso === 'leyendo'
            ? 'Quedate quieto un momento.'
            : modelosListos
              ? 'Cuando estés listo, tocá el botón.'
              : 'Preparando el detector…'}
        </p>

        <div className="deteccion-acciones">
          <button
            type="button"
            className="deteccion-boton"
            disabled={!modelosListos || paso === 'leyendo'}
            onClick={leerAnimo}
          >
            Leer mi ánimo
          </button>
          <button type="button" className="deteccion-boton secundario" disabled={paso === 'leyendo'} onClick={cancelar}>
            Apagar cámara
          </button>
        </div>
      </div>

      {paso === 'resultado' && datosEmocion && (
        <div className="deteccion-resultado">
          <span className="deteccion-emoji" aria-hidden="true">
            {datosEmocion.emoji}
          </span>
          <h1 id="titulo-deteccion" className="deteccion-titulo">
            {datosEmocion.frase}
          </h1>
          <p className="deteccion-texto">
            Seguridad de la lectura: {Math.round(resultado.confianza * 100)} %. La cámara ya está apagada.
          </p>

          <div className="deteccion-acciones">
            <button type="button" className="deteccion-boton" onClick={verRecomendaciones}>
              Ver recomendaciones
            </button>
            <button type="button" className="deteccion-boton secundario" onClick={activarCamara}>
              Leer otra vez
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="deteccion-error" role="alert">
          {error}
        </p>
      )}

      {aviso && <p className="deteccion-aviso">{aviso}</p>}
    </section>
  );
}
