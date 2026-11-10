// Las emociones del contrato con el backend (backend/src/schemas/emotions.js):
// las 7 de face-api más `tired`, que solo se elige a mano al corregir el ánimo.
export const EMOCIONES = {
  happy: { nombre: 'Feliz', emoji: '😄', frase: 'Te vemos feliz' },
  sad: { nombre: 'Triste', emoji: '😢', frase: 'Te vemos bajoneado' },
  angry: { nombre: 'Enojado', emoji: '😠', frase: 'Te vemos enojado' },
  fearful: { nombre: 'Con miedo', emoji: '😨', frase: 'Te vemos con miedo' },
  disgusted: { nombre: 'Disgustado', emoji: '🤢', frase: 'Te vemos disgustado' },
  surprised: { nombre: 'Sorprendido', emoji: '😲', frase: 'Te vemos sorprendido' },
  neutral: { nombre: 'Neutral', emoji: '😐', frase: 'Te vemos tranquilo' },
  tired: { nombre: 'Cansado', emoji: '😴', frase: 'Te vemos cansado' },
};
