-- Complementa 20261110052633_init_butaca sin modificarla.
-- Requiere Supabase: auth.users, auth.uid() y los roles de su Data API.
-- La FK a auth.users y RLS se mantienen en SQL, fuera del modelo de Prisma 5.
-- Prisma validate y migrate diff no validan estas políticas.
-- Para aplicar en Supabase: migrate deploy, solo con autorización previa.
-- migrate dev requiere una base temporal compatible con las dependencias de Supabase;
-- no usar db push ni regenerar esta FK automáticamente desde el datamodel.
-- La migración inicial crea las tablas sin RLS: antes de aplicar el conjunto,
-- se debe impedir acceso a ellas por Data API hasta completar esta migración.
BEGIN;

-- El perfil usa la identidad existente de Supabase Auth.
-- No se crean usuarios, funciones ni triggers en el esquema auth.
ALTER TABLE public."profiles"
    ADD CONSTRAINT "profiles_id_fkey"
    FOREIGN KEY ("id") REFERENCES auth.users("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Evita recomendaciones sin perfil y conserva la misma cascada que moods/favorites.
ALTER TABLE public."recommendations"
    ADD CONSTRAINT "recommendations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public."profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."moods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."favorites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recommendations" ENABLE ROW LEVEL SECURITY;

-- La aplicación escribe a través de Express, no directamente por la Data API.
-- Quita privilegios heredados de los roles de la API y del rol PUBLIC.
REVOKE ALL PRIVILEGES ON TABLE
    public."profiles", public."moods", public."favorites", public."recommendations"
    FROM PUBLIC, anon, authenticated;

-- authenticated solo puede leer; las políticas restringen esa lectura al dueño.
GRANT SELECT ON TABLE
    public."profiles", public."moods", public."favorites", public."recommendations"
    TO authenticated;

-- Rol administrativo de Supabase: conservar acceso de servidor, nunca de navegador.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public."profiles", public."moods", public."favorites", public."recommendations"
    TO service_role;

CREATE POLICY "profiles_select_own" ON public."profiles"
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = "id");

CREATE POLICY "moods_select_own" ON public."moods"
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = "userId");

CREATE POLICY "favorites_select_own" ON public."favorites"
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = "userId");

CREATE POLICY "recommendations_select_own" ON public."recommendations"
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = "userId");

-- No hay políticas de escritura para authenticated ni acceso para anon.
-- El propietario y los roles BYPASSRLS no dependen de estas políticas.
-- El backend debe verificar el JWT y filtrar SIEMPRE por el UUID verificado.
-- La creación idempotente de perfiles al primer acceso corresponde al backend.
COMMIT;
