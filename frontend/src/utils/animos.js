// Los 5 ánimos que muestra la interfaz. Agrupan las emociones del contrato con el backend
// (utils/emociones.js) para el color, el slider de corrección y el tablero.
// - `emociones`: las que caen en este ánimo cuando las detecta face-api.
// - `emocion`: la que se guarda si la persona elige este ánimo a mano en el slider.
// - `color`: tono de la paleta; `brillo`: versión clara para usar sobre fondo oscuro.
// El orden va de menor a mayor energía: es el orden del slider.
export const ANIMOS = [
  {
    id: 'triste',
    nombre: 'Tristeza',
    frase: 'Te notamos con algo de tristeza',
    emocion: 'sad',
    emociones: ['sad', 'fearful', 'disgusted'],
    color: '#42164b',
    brillo: '#a678b8',
  },
  {
    id: 'cansada',
    nombre: 'Cansancio',
    frase: 'Te notamos con cansancio',
    emocion: 'tired',
    emociones: ['tired'],
    color: '#622347',
    brillo: '#c0849f',
  },
  {
    id: 'neutral',
    nombre: 'Calma',
    frase: 'Te notamos con calma',
    emocion: 'neutral',
    emociones: ['neutral'],
    color: '#e0b4b2',
    brillo: '#e0b4b2',
  },
  {
    id: 'contenta',
    nombre: 'Alegría',
    frase: 'Te notamos con alegría',
    emocion: 'happy',
    emociones: ['happy'],
    color: '#e99856',
    brillo: '#f0ac72',
  },
  {
    id: 'energia',
    nombre: 'Energía',
    frase: 'Te notamos con mucha energía',
    emocion: 'angry',
    emociones: ['angry', 'surprised'],
    color: '#a54055',
    brillo: '#e06a84',
  },
];

export function animoDeEmocion(emocion) {
  return ANIMOS.find((a) => a.emociones.includes(emocion)) ?? ANIMOS[2];
}

// Tiñe toda la interfaz con el color del ánimo (ver styles/tokens.css).
export function aplicarAura(animo) {
  if (animo) document.documentElement.dataset.animo = animo.id;
  else delete document.documentElement.dataset.animo;
}
