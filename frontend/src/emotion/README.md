# emotion/

Detección de emoción en el navegador (opción A: `@vladmandic/face-api`).

Reglas de privacidad (no negociables):
- Pedir consentimiento explícito antes de encender la cámara y explicar para qué.
- La imagen **no se guarda ni se envía** al backend: solo se manda la emoción detectada (p. ej. `"happy"`).
- Apagar la cámara apenas se detecta el ánimo.

Los modelos de face-api van en `public/models/`.
