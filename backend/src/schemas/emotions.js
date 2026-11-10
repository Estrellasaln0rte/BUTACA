import { z } from 'zod';

// Las 7 emociones que devuelve face-api.js, más `tired` (cansada), que face-api no detecta
// pero la persona puede elegir al corregir su ánimo. Es el CONTRATO entre front y back:
// si cambia, avisar a Front 2 (De La Roca) y a Back 2 (Lizz, regla ánimo → géneros).
export const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'tired'];

export const emotionSchema = z.enum(EMOTIONS);