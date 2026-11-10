# Repositorios de Butaca

`createRepositories({ prisma, now })` construye los repositorios; ambos parámetros
son opcionales. El cliente por defecto se comparte y se construye al primer uso.
Las pruebas inyectan un doble, sin usar `.env`, Supabase ni TMDB.

## Estado de la integración

Los repositorios están conectados en `backend/src/server.js`. Las rutas existentes
de emociones, favoritos y dashboard los reciben a través de `createApp`; la ruta
de recomendaciones guarda el historial después de consultar TMDB y antes de
responder. Si guardarlo falla, el error queda en el log y la ruta responde igual
200 con las recomendaciones: el historial no bloquea al usuario. Se conservan los
contratos HTTP y el algoritmo de recomendaciones.

Al recibir `SIGTERM` o `SIGINT`, `server.js` deja de aceptar conexiones, termina
las solicitudes en curso y llama a `disconnectPrisma()` (ver `src/lib/shutdown.js`).

En el entorno actual de Supabase ya se aplicaron y verificaron, en este orden:

1. `20261110052633_init_butaca`.
2. `20261110055154_profile_integrity_and_rls`.

La última auditoría de solo lectura confirmó las cuatro tablas, sus claves
foráneas e índices, la unicidad de favoritos, RLS y las cuatro políticas de lectura
propia. Los checksums remotos coinciden con los archivos de migración locales.
El cliente Prisma 5.22.0 está generado localmente; otro entorno debe generarlo.
La Data API del proyecto permanece desactivada según confirmación del responsable.

## Identidad y operaciones

El primer argumento de todos los métodos es el UUID obtenido por el verificador
de Supabase. Los repositorios validan su formato; no verifican JWT ni convierten
un UUID enviado por el navegador en una identidad autenticada. La conexión verificada
usa `postgres` con `BYPASSRLS`, de modo que todas las consultas se filtran por este
UUID. Los cuerpos con `userId`, `id` o campos no previstos se rechazan.

| Repositorio | Métodos |
| --- | --- |
| `profilesRepo` | `ensure(userId)` |
| `moodsRepo` | `create(userId, { emotion, confidence? })`, `list(userId, { limit? })` |
| `favoritesRepo` | `list(userId)`, `add(userId, { tmdbId, mediaType, title, posterPath? })`, `remove(userId, { mediaType, tmdbId })` |
| `recommendationsRepo` | `createMany(userId, records)`, `list(userId, { limit? })` |
| `dashboardRepo` | `summary(userId, { days? })` |

`ensure` inserta el perfil con `skipDuplicates` y devuelve el existente si ya fue
creado. Las escrituras de emociones, favoritos y recomendaciones crean el perfil
dentro de su transacción. La FK a `auth.users(id)` requiere que el UUID exista en Auth.
Las lecturas de un usuario sin datos devuelven listas vacías sin crear perfiles.

Los favoritos duplicados mantienen el error Prisma `P2002`, que el middleware
existente traduce a HTTP 409. `remove` devuelve un booleano y filtra propietario,
tipo e ID en un único `deleteMany`. No hay métodos de actualización de propietario
ni métodos para borrar datos de otro usuario. Los errores de Zod y Prisma se
propagan al manejador existente; no se registran credenciales en estos módulos.

Cada registro de recomendaciones es `{ emotion, mediaType, tmdbId, genreIds }`.
Los géneros son los filtros usados en la búsqueda; el repositorio no ejecuta el
algoritmo ni llama a TMDB. Cada lote admite hasta 200 registros y se valida antes
de escribir. Un lote vacío devuelve `{ count: 0 }`. Se eliminan géneros repetidos
dentro de un registro; solicitudes distintas se conservan como historial.

El listado de emociones entrega los últimos N en orden cronológico; el historial
de recomendaciones entrega los últimos N primero. Ambos usan 50 por defecto y
aceptan de 1 a 200, como la validación existente de historial de emociones.

El dashboard usa los últimos `days` períodos de 24 horas hasta el instante de la
consulta, con ambos extremos incluidos, y una transacción `RepeatableRead` para
leer emociones y recomendaciones de la misma instantánea. Devuelve:

```js
{
  days: 30,
  moodsOverTime: [{ emotion: 'sad', at: '2026-11-10T12:00:00.000Z' }],
  recommendedGenres: [{ id: 35, name: 'Comedia', mediaType: 'movie', count: 1 }],
}
```

`count` cuenta registros de títulos recomendados con ese género de búsqueda.
Películas y series se cuentan por separado; se ordena por frecuencia descendente,
tipo y género. Los nombres reutilizan el catálogo existente, sin modificar la
regla de recomendaciones; un ID desconocido se presenta como `Género <id>`.

## Validación local

Desde `backend`, con las dependencias ya instaladas:

```powershell
node ../node_modules/vitest/vitest.mjs run --cache=false
node ../node_modules/eslint/bin/eslint.js .
```

Estas pruebas usan mocks de Prisma, Supabase Auth y TMDB. Comprueban filtros por
usuario, validación, unicidad simulada, rollback simulado y conexión entre rutas
y repositorios. No prueban escrituras reales, concurrencia ni aislamiento entre
usuarios reales en PostgreSQL.

Las comprobaciones remotas realizadas fueron únicamente de lectura: metadatos,
permisos e instrucciones `count()` de Prisma. Las pruebas reales de escritura
siguen pendientes. Está prohibido insertar, actualizar o eliminar datos en
Supabase, o crear usuarios de prueba, sin autorización explícita. No se deben
invocar rutas reales que escriban durante una revisión; esto incluye
`GET /api/recommendations`, que persiste historial aunque use el método GET.

## Configuración privada de un entorno

Usar las versiones fijadas por el proyecto y su archivo de bloqueo; la versión
verificada de Prisma y `@prisma/client` es 5.22.0. Los comandos siguientes presuponen
que las dependencias ya están instaladas. No actualizarlas como parte de este flujo.

Configurar privadamente `backend/.env` o las variables del servidor de despliegue,
de acuerdo con `backend/src/config/env.js`:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL del backend. El entorno verificado usa pooler de transacciones en 6543 con `pgbouncer=true`. |
| `DIRECT_URL` | Conexión para migraciones. El entorno verificado usa pooler de sesión en 5432. |
| `SUPABASE_URL` | URL del proyecto cuyo Auth verifica los tokens. Debe corresponder al mismo proyecto que PostgreSQL. |
| `SUPABASE_ANON_KEY` | Clave pública del proyecto usada por el verificador del backend. |
| `TMDB_API_KEY` | Credencial de TMDB, exclusiva del backend. |
| `FRONTEND_URL` | Origen permitido por CORS. |
| `NODE_ENV` | Entorno de ejecución; por defecto `development`. |
| `PORT` | Puerto del backend; por defecto `3000`. |

No incluir valores reales en documentación, commits, capturas o logs. Nunca enviar
la contraseña PostgreSQL, una clave administrativa de Supabase ni la clave de TMDB
al frontend. Mantener la configuración SSL aprobada; no desactivar verificaciones
de certificados para resolver errores de conexión. La configuración local pendiente
de Supabase y TMDB debe completarse antes de arrancar el backend real.

Desde `backend`, validar el esquema y generar el cliente para ese entorno:

```powershell
npm run prisma:validate
npm run prisma:generate
```

Estos comandos no aplican migraciones ni insertan datos en Supabase. El cliente
generado se guarda en `node_modules` y no se incluye en el commit.

## Aplicación segura en otro entorno autorizado

Este procedimiento no autoriza por sí mismo escrituras remotas. En el proyecto
actual las dos migraciones ya están aplicadas: no volver a ejecutarlas manualmente
ni modificar sus archivos. Para otro destino, obtener autorización expresa antes
de aplicar cambios; no crear proyectos ni datos de prueba automáticamente.

1. Confirmar el proyecto y la base de datos de destino, la conexión y los permisos
   del rol de migración. Revisar el historial y las tablas existentes. Si aparecen
   datos u objetos no previstos, detenerse y acordar su protección antes de continuar.
2. Desactivar la Data API desde el panel de Supabase y confirmar el cambio. Mantenerla
   desactivada durante el procedimiento: la primera migración crea tablas sin RLS
   y las dos migraciones no se ejecutan dentro de una única transacción.
3. Desde `backend`, consultar el estado con Prisma local:

   ```powershell
   node ../node_modules/prisma/build/index.js migrate status
   ```

   En un destino nuevo deben estar pendientes las dos migraciones listadas arriba
   y las cuatro tablas deben estar ausentes. El código 1 puede indicar migraciones
   pendientes, pero también errores: revisar el mensaje antes de continuar. En un
   entorno ya migrado, comprobar el historial en lugar de recrear tablas.
4. Solo si el destino y los archivos coinciden con lo aprobado, aplicar los SQL
   pendientes con Prisma 5.22.0 local:

   ```powershell
   node ../node_modules/prisma/build/index.js migrate deploy
   ```

   No usar el script `prisma:migrate`: actualmente ejecuta `migrate dev`. Para este
   despliegue se usa `migrate deploy`, que no necesita una base temporal con Auth.
   No utilizar resets ni `db push` para resolver diferencias.
5. Proteger también `public._prisma_migrations`. En el entorno actual ya se hizo
   mediante un `REVOKE` autorizado; este cambio no forma parte de las dos migraciones.
   En un entorno nuevo, una vez que exista la tabla y con autorización para esta
   operación adicional, ejecutar:

   ```sql
   REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations
   FROM PUBLIC, anon, authenticated;
   ```

   Si el historial ya existe antes del despliegue, se puede proteger antes de aplicar
   las migraciones. Verificar que el propietario conserve acceso y que los roles
   anteriores carezcan de permisos efectivos sobre esa tabla.
6. Ejecutar únicamente verificaciones de lectura: estado de migraciones, checksums,
   cuatro tablas, cuatro FK, ocho índices y unicidad de favoritos; RLS activo y cuatro
   políticas de lectura propia; `anon` sin acceso y `authenticated` solo con `SELECT`
   sujeto a RLS. Comprobar también la protección del historial y los `count()` de los
   cuatro modelos mediante Prisma.
7. Mantener la Data API desactivada hasta revisar los resultados y recibir autorización
   específica para reactivarla. Si falla cualquier paso, detenerse sin resets ni
   correcciones automáticas.

Para cambios futuros, conservar los esquemas anterior y nuevo y generar el SQL con
`prisma migrate diff --from-schema-datamodel <anterior> --to-schema-datamodel <nuevo> --script`.
Revisar por separado la FK a `auth.users`, los permisos y RLS: no se representan
completamente en el datamodel ni se validan con ese diff. Aplicar únicamente el SQL
revisado y autorizado mediante `migrate deploy`, preservando las migraciones ya aplicadas.
