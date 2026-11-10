// Las emociones del contrato con el backend (backend/src/schemas/emotions.js):
// las 7 que devuelve face-api.js. El front no usa ninguna otra.
export const EMOCIONES = {
  happy: { nombre: 'Feliz', emoji: '😄', frase: 'Te vemos feliz' },
  sad: { nombre: 'Triste', emoji: '😢', frase: 'Te vemos bajoneado' },
  angry: { nombre: 'Enojado', emoji: '😠', frase: 'Te vemos enojado' },
  fearful: { nombre: 'Con miedo', emoji: '😨', frase: 'Te vemos con miedo' },
  disgusted: { nombre: 'Disgustado', emoji: '🤢', frase: 'Te vemos disgustado' },
  surprised: { nombre: 'Sorprendido', emoji: '😲', frase: 'Te vemos sorprendido' },
  neutral: { nombre: 'Neutral', emoji: '😐', frase: 'Te vemos tranquilo' },
};
