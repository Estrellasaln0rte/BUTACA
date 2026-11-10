// Los ánimos que muestra la interfaz: exactamente las 7 emociones de la API
// (backend/src/schemas/emotions.js), una por una, sin agrupar ni agregar otras.
// - `id` y `emocion`: la etiqueta que se manda y se recibe del backend.
// - `nombre`: cómo se nombra en pantalla ("Elegidas para tu alegría").
// - `color`: tono de la paleta; `brillo`: versión clara para usar sobre fondo oscuro.
// - `grafico`: color del tablero. Este orden y estos tonos están validados para que los 7 se
//   distingan entre sí, también con daltonismo (en pantalla siempre van con su nombre al lado).
export const ANIMOS = [
  {
    id: 'sad',
    emocion: 'sad',
    nombre: 'Tristeza',
    frase: 'Te notamos con algo de tristeza',
    color: '#42164b',
    brillo: '#a678b8',
    grafico: '#3987e5',
  },
  {
    id: 'happy',
    emocion: 'happy',
    nombre: 'Alegría',
    frase: 'Te notamos con alegría',
    color: '#e99856',
    brillo: '#f0ac72',
    grafico: '#d95926',
  },
  {
    id: 'neutral',
    emocion: 'neutral',
    nombre: 'Calma',
    frase: 'Te notamos con calma',
    color: '#e0b4b2',
    brillo: '#e0b4b2',
    grafico: '#199e70',
  },
  {
    id: 'surprised',
    emocion: 'surprised',
    nombre: 'Sorpresa',
    frase: 'Te notamos con sorpresa',
    color: '#f2b04a',
    brillo: '#f6c66e',
    grafico: '#c98500',
  },
  {
    id: 'disgusted',
    emocion: 'disgusted',
    nombre: 'Disgusto',
    frase: 'Te notamos con algo de disgusto',
    color: '#6a7a3e',
    brillo: '#b4c27e',
    grafico: '#008300',
  },
  {
    id: 'fearful',
    emocion: 'fearful',
    nombre: 'Miedo',
    frase: 'Te notamos con algo de miedo',
    color: '#2c3a66',
    brillo: '#9fb0e0',
    grafico: '#9085e9',
  },
  {
    id: 'angry',
    emocion: 'angry',
    nombre: 'Enojo',
    frase: 'Te notamos con enojo',
    color: '#a54055',
    brillo: '#e06a84',
    grafico: '#e66767',
  },
];

export function animoDeEmocion(emocion) {
  return ANIMOS.find((a) => a.emocion === emocion) ?? ANIMOS.find((a) => a.id === 'neutral');
}

// Tiñe toda la interfaz con el color del ánimo (fondo-vivo.css y tokens.css usan html[data-animo]).
export function aplicarAura(animo) {
  if (animo) document.documentElement.dataset.animo = animo.id;
  else delete document.documentElement.dataset.animo;
}
