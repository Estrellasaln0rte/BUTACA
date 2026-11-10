import { z } from 'zod';

// Las 7 emociones que devuelve face-api.js. Es el CONTRATO entre front y back:
// si cambia, avisar a Front 2 (De La Roca) y a Back 2 (Lizz, regla ánimo → géneros).
export const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];

export const emotionSchema = z.enum(EMOTIONS);