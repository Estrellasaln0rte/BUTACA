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
| GET | `/api/recommendations?emotion=sad&mediaType=movie&page=1` | — | `{ emotion, mediaType, genres: [{ id, name }], page, totalPages, totalResults, items: [{ tmdbId, mediaType, title, overview, posterPath, releaseDate, rating }] }`; 502 si TMDB falla | 🔒 ✅ |
| GET | `/api/favorites` | — | `{ items: [favorito] }`, del más reciente al más antiguo | 🔒 ✅ |
| POST | `/api/favorites` | `{ tmdbId, mediaType: "movie" o "tv", title, posterPath? }` | el favorito creado (201); 409 si ya existe | 🔒 ✅ |
| DELETE | `/api/favorites/:mediaType/:tmdbId` | — | 204 (404 si no existe) | 🔒 ✅ |
| POST | `/api/moods` | `{ emotion, confidence? }` | el ánimo registrado (201) | 🔒 ✅ |
| GET | `/api/moods?limit=50` | — | `{ items: [ánimo] }`: los últimos `limit` (1 a 200) en orden cronológico | 🔒 ✅ |
| GET | `/api/dashboard?days=30` | — | `{ days, moodsOverTime, recommendedGenres }` (ver abajo) | 🔒 ✅ |

🔒 = exige sesión. ✅ = funcionando, conectado a Supabase (PostgreSQL) mediante Prisma.

**Forma de los registros** (`id` es un UUID; las fechas llegan como texto ISO 8601):

- favorito: `{ id, userId, tmdbId, mediaType, title, posterPath, createdAt }`
- ánimo: `{ id, userId, emotion, confidence, createdAt }` (`confidence` puede ser `null`)

`userId` siempre es el de la sesión: nunca se acepta en el body ni en la query. El perfil del usuario se crea solo la primera vez que guarda algo.

**Dashboard** (`days` de 1 a 365, por defecto 30; cuenta los últimos `days` períodos de 24 horas):

```json
{
  "days": 30,
  "moodsOverTime": [{ "emotion": "sad", "at": "2026-11-10T12:00:00.000Z" }],
  "recommendedGenres": [{ "id": 35, "name": "Comedia", "mediaType": "movie", "count": 20 }]
}
```

`moodsOverTime` va en orden cronológico. `recommendedGenres` sale del historial de recomendaciones, ordenado de mayor a menor `count`; películas y series se cuentan por separado. `count` es la cantidad de **títulos** recomendados con ese género (una consulta que devolvió 20 títulos suma 20).

**Emociones válidas** (`emotion`): `neutral`, `happy`, `sad`, `angry`, `fearful`, `disgusted`, `surprised`. No se aceptan campos extra (nunca una imagen).

**Autenticación:** las rutas 🔒 exigen `Authorization: Bearer <access_token de Supabase>`. Sin token o con token inválido responde `401`.

**Errores:** `400` datos inválidos (`{ error, details }`), `401` sin sesión, `404` no encontrado, `409` ya existe, `413` body mayor a 10 KB, `426` HTTP plano en producción, `429` demasiadas solicitudes, `500` error interno (sin detalles), `502` TMDB no disponible (sin detalles).

## Recomendaciones (TMDB)

`GET /api/recommendations` recibe la emoción detectada, la traduce a géneros de TMDB y devuelve títulos populares de esos géneros. Basta con que un título tenga **uno** de los géneros.

| Parámetro | Valores | Por defecto |
|---|---|---|
| `emotion` | una de las 7 emociones válidas | obligatorio |
| `mediaType` | `movie` o `tv` | `movie` |
| `page` | 1 a 500 (TMDB no entrega más) | `1` |

- Resultados en español (`es-MX`), ordenados por popularidad, sin contenido adulto y con al menos 50 votos.
- Cada `item` tiene la misma forma que pide `POST /api/favorites`, así se puede guardar como favorito directamente.
- Póster: `https://image.tmdb.org/t/p/w342${posterPath}` (`posterPath` puede ser `null`).
- `genres[].name` viene en español para mostrarlo en la interfaz ("Te recomendamos Comedia y Animación").
- Límite estricto: 20 solicitudes por minuto (gasta cuota de TMDB).
- Si TMDB falla o tarda más de 5 segundos responde `502`; el detalle solo queda en el log del servidor.
- **Guarda historial:** cada consulta registra los títulos recomendados (`emotion`, `mediaType`, `tmdbId` y los géneros buscados) para el dashboard. Por eso, aunque es un `GET`, no conviene llamarla en revisiones contra la base real. Si el historial no se puede guardar, la respuesta no cambia (200 con las recomendaciones) y el error queda en el log.

### Regla ánimo → géneros

Criterio: recomendar algo que **ayude** con el ánimo detectado, no solo que lo refleje. Vive en `backend/src/services/moodToGenres.js`; para cambiar el criterio se edita solo la tabla `MOOD_GENRES` (las pruebas avisan si falta una emoción o se usa un ID que no existe).

| Emoción | Por qué | Películas | Series |
|---|---|---|---|
| `happy` | mantener la buena racha | Comedia, Aventura, Música | Comedia, Acción y aventura |
| `sad` | levantar el ánimo | Comedia, Animación, Familia | Comedia, Animación, Familia |
| `angry` | descargar la energía | Acción, Suspenso | Acción y aventura, Crimen |
| `fearful` | evasión ligera, lejos de lo que asusta | Aventura, Fantasía, Comedia | Acción y aventura, Ciencia ficción y fantasía, Comedia |
| `disgusted` | algo amable para limpiar la sensación | Romance, Fantasía | Familia, Ciencia ficción y fantasía |
| `surprised` | seguir con la intriga | Misterio, Ciencia ficción | Misterio, Ciencia ficción y fantasía |
| `neutral` | variedad para descubrir | Drama, Aventura, Ciencia ficción | Drama, Ciencia ficción y fantasía |

TMDB usa IDs distintos para películas y series, y algunos géneros no existen en series (Terror, Romance, Suspenso; Aventura y Fantasía solo existen combinados). Por eso hay un mapa para cada tipo.
