# Cómo trabajamos en Butaca

## Ramas

- `production`: lo que se entrega/despliega. Protegida, solo se actualiza desde `dev` vía PR.
- `dev`: integración del equipo. Protegida, todo entra por PR.
- Ramas de trabajo, siempre desde `dev`:
  - `feat/front-<descripcion>` · `feat/back-<descripcion>`
  - `fix/<descripcion>` · `test/<descripcion>` · `docs/<descripcion>` · `chore/<descripcion>`

```bash
git checkout dev
git pull origin dev
git checkout -b feat/back-ruta-recomendaciones
# ... trabajo ...
git push -u origin feat/back-ruta-recomendaciones
# abrir PR hacia dev
```

## Commits (Conventional Commits)

```
feat(back): agrega ruta GET /api/recommendations
fix(front): corrige permiso de cámara en Safari
test(back): pruebas de integración para favoritos
docs: actualiza README
chore(ci): agrega job de E2E
```

## Pull Requests

1. Un PR = una tarea (idealmente ligada a un issue: `Cierra #12`).
2. Completar la plantilla del PR, incluidas las 3 preguntas de la clienta.
3. El CI tiene que estar en verde.
4. Al menos **1 aprobación** de otra persona del equipo.
5. Se mergea con **Squash and merge** y se borra la rama.

## Reglas de oro

- Nunca subir `.env` ni llaves. Si agregás una variable, actualizá el `.env.example` y `backend/src/config/env.js`.
- El front **nunca** llama a TMDB directamente: siempre pasa por el backend.
- La imagen de la cámara no se guarda ni se envía.
- Toda ruta nueva del backend lleva validación (Zod) y al menos una prueba.

## Responsabilidades por carpeta

| Carpeta | Responsable |
|---|---|
| `frontend/` | Equipo front |
| `backend/`, `backend/prisma/` | Equipo back |
| `e2e/` | Ambos |
| `.github/`, `docs/` | Responsable del repo |
