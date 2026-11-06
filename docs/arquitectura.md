# Arquitectura

```
[Navegador]
  React + Vite
  ├─ cámara + face-api.js → emoción (la imagen no sale del navegador)
  ├─ Supabase Auth (Google / GitHub) → token de sesión
  └─ fetch al backend con el token
          │
          ▼
[Backend Express]
  helmet · CORS · rate limit · validación Zod · middleware de auth
  ├─ /api/recommendations → llama a TMDB (key en .env)
  ├─ /api/moods           → registra ánimos
  ├─ /api/favorites       → CRUD de favoritas
  └─ /api/dashboard       → consultas para el tablero
          │
          ▼
[Supabase PostgreSQL] vía Prisma
```

> Las rutas son una propuesta inicial; el equipo de back las define y documenta aquí.

## Contrato front ↔ back

Documentar aquí cada endpoint a medida que se acuerde (método, ruta, body, respuesta), para que front y back trabajen en paralelo.

| Método | Ruta | Body | Respuesta | Estado |
|---|---|---|---|---|
| GET | `/api/health` | — | `{ status: "ok" }` | ✅ |
