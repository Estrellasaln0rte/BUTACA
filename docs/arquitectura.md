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
| GET | `/api/favorites` | — | `{ items: [{ id, tmdbId, mediaType, title, posterPath }] }` | 🔒 🚧 |
| POST | `/api/favorites` | `{ tmdbId, mediaType: "movie" o "tv", title, posterPath? }` | favorito creado (201); 409 si ya existe | 🔒 🚧 |
| DELETE | `/api/favorites/:mediaType/:tmdbId` | — | 204 (404 si no existe) | 🔒 🚧 |
| POST | `/api/moods` | `{ emotion, confidence? }` | ánimo registrado (201) | 🔒 🚧 |
| GET | `/api/moods?limit=50` | — | `{ items: [...] }` | 🔒 🚧 |
| GET | `/api/dashboard?days=30` | — | `{ days, moodsOverTime, recommendedGenres }` | 🔒 🚧 |

🔒 = exige sesión. 🚧 = rutas y validaciones listas; falta conectar el repositorio de Prisma.

**Emociones válidas** (`emotion`): `neutral`, `happy`, `sad`, `angry`, `fearful`, `disgusted`, `surprised`. No se aceptan campos extra (nunca una imagen).

**Autenticación:** las rutas 🔒 exigen `Authorization: Bearer <access_token de Supabase>`. Sin token o con token inválido responde `401`.

**Errores:** `400` datos inválidos (`{ error, details }`), `401` sin sesión, `404` no encontrado, `409` ya existe, `413` body mayor a 10 KB, `426` HTTP plano en producción, `429` demasiadas solicitudes, `500` error interno (sin detalles).