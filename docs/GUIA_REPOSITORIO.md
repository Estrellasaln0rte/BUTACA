# Guía para la responsable del repositorio

Pasos para dejar el repo listo antes de que el equipo empiece. Hacelos en este orden.

## 1. Crear el repositorio en GitHub
1. github.com → **New repository** → nombre `butaca`, sin README ni .gitignore (ya los tenemos).
2. En esta carpeta:
   ```bash
   git init -b production
   npm install                 # genera package-lock.json (subilo, el CI lo usa)
   git add .
   git commit -m "chore: plantilla inicial del proyecto"
   git remote add origin https://github.com/<tu-usuario>/butaca.git
   git push -u origin production
   git checkout -b dev
   git push -u origin dev
   ```
3. Revisá que `node_modules/` y ningún `.env` se hayan subido.

## 2. Invitar al equipo
Settings → **Collaborators** → Add people (rol *Write*). Después reemplazá los `@USUARIO_...` en `.github/CODEOWNERS` y la tabla de Equipo del README.

## 3. Proteger las ramas
Settings → General → Default branch: elegir `dev` (así los PR apuntan ahí por defecto).

Settings → **Branches** (o Rules → Rulesets) → agregar regla para `production` y otra para `dev`:
- ✅ Require a pull request before merging → 1 aprobación
- ✅ Require review from Code Owners (opcional, recomendado)
- ✅ Require status checks to pass → elegir `Backend (lint + pruebas)` y `Frontend (lint + build)` (aparecen después de que el CI corra una vez)
- ✅ Require branches to be up to date before merging
- ✅ Block force pushes

Settings → General → Pull Requests: dejar solo **Allow squash merging** y activar **Automatically delete head branches**.

## 4. Secretos para el CI
Settings → Secrets and variables → **Actions** → New repository secret:
`TMDB_API_KEY`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
(Hoy el CI no los necesita, pero las pruebas de integración reales sí.)

## 5. Servicios externos
- **TMDB y Supabase** los configura el equipo de back (ya acordado). Las llaves se comparten por un canal privado, nunca en el repo.

## 6. Organizar el trabajo
- Issues → **Labels**: `frontend`, `backend`, `database`, `ci`, `docs`, `feature`, `bug`.
- Projects → **New project** (Board) con columnas *Por hacer / En progreso / En revisión / Hecho*.
- Crear los primeros issues a partir de los criterios de aceptación de Majo (login, cámara + consentimiento, recomendaciones, favoritos, tablero, seguridad, pruebas, E2E, despliegue).

## 7. Primer acuerdo de equipo
Antes de programar, acuerden entre front y back el contrato de la API en `docs/arquitectura.md`. Así cada lado avanza sin esperar al otro.
