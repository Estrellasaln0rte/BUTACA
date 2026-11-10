# Butaca 🎬

> "Que nadie más pierda veinte minutos decidiendo."

Butaca detecta tu ánimo con la cámara (con tu permiso) y te recomienda películas y series de **TMDB** acordes a cómo te sentís. Guardás favoritas y ves en un tablero cómo fue cambiando tu ánimo.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite, detección de emoción con `@vladmandic/face-api` |
| Backend | Node + Express, Zod, helmet, CORS, rate limit |
| Base de datos | Prisma + Supabase (PostgreSQL) |
| Autenticación | Supabase Auth (Google / GitHub) |
| Pruebas | Vitest + Supertest (back), Playwright (E2E) |
| CI | GitHub Actions |

## Estructura

```
BUTACA/
├── frontend/          # React + Vite (equipo front)
│   └── src/
│       ├── components/  pages/  hooks/  context/  styles/
│       ├── services/    # llamadas al backend propio
│       └── emotion/     # cámara + detección de ánimo
├── backend/           # Express + Prisma (equipo back)
│   ├── prisma/        # schema.prisma y migraciones
│   ├── src/
│   │   ├── config/      # env.js (validación con Zod)
│   │   ├── routes/  controllers/  services/  middlewares/  schemas/  lib/
│   │   ├── app.js       # arma la app (testeable)
│   │   └── server.js    # levanta el servidor
│   └── tests/         # unit/ e integration/
├── e2e/               # pruebas Playwright
├── docs/              # arquitectura y contrato de la API
└── .github/           # CI, plantillas de PR e issues, CODEOWNERS
```

## Cómo correrlo localmente

Requisitos: Node 22+ y npm.

```bash
git clone <url-del-repo>
cd butaca
npm install                       # instala front y back (npm workspaces)

cp backend/.env.example backend/.env     # completar con valores reales
cp frontend/.env.example frontend/.env

npm run dev:back                  # http://localhost:3000/api/health
npm run dev:front                 # http://localhost:5173
```

## Scripts (desde la raíz)

| Comando | Qué hace |
|---|---|
| `npm run dev:front` / `npm run dev:back` | Levanta front o back en modo desarrollo |
| `npm run lint` | Lint de todo el proyecto |
| `npm test` | Pruebas unitarias e integración |
| `npm run build` | Build de producción del front |
| `npm run test:e2e` | Pruebas E2E con Playwright |

## Pipeline (GitHub Actions)

| Workflow | Cuándo corre | Qué hace |
|---|---|---|
| `ci.yml` | Cada push y PR hacia `dev` y `production` | Lint, validación del schema de Prisma, pruebas del backend con cobertura (falla si baja de 80% de líneas), build del frontend y auditoría de dependencias. En PRs hacia `production` también corre las pruebas E2E. |
| `release.yml` | Cada push a `production` | Arma la versión de entrega (front compilado + back) y la publica como paquete descargable en la pestaña Actions. |
| `dependabot.yml` | Semanal | Abre PRs hacia `dev` para actualizar dependencias con vulnerabilidades. |

Un PR no se puede mergear si el pipeline está en rojo.

## Privacidad y seguridad

- La cámara se enciende solo con consentimiento explícito. **La imagen nunca se guarda ni sale del navegador**; solo se envía la emoción detectada.
- La API key de TMDB vive únicamente en el backend (`backend/.env`). Nada secreto va en variables `VITE_`.
- Ver [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo de trabajo del equipo.
- Las rutas de datos (`/api/favorites`, `/api/moods`, `/api/dashboard`) exigen el token de Supabase y cada consulta se filtra por el usuario de la sesión.
- Seguridad HTTP: helmet, CORS limitado a `FRONTEND_URL`, rate limit (100 por minuto en general, 20 en recomendaciones), bodies de máximo 10 KB y HTTPS obligatorio en producción.
- `/api/moods` solo acepta la etiqueta de emoción: cualquier otro campo (por ejemplo una imagen) se rechaza.
- Los errores internos nunca exponen detalles al cliente.

## Equipo

| Rol | Integrante | GitHub |
|---|---|---|
| Líder / responsable del repo | Marcela | @... |
| Frontend | | |
| Backend | | |

---
Proyecto Final · Programación Web · Universidad Rafael Landívar
