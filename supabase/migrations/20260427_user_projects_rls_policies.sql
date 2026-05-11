-- ============================================================
-- RLS policies para asignación de autores/coautores en user_projects
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1) Activar RLS
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

-- 2) Limpiar políticas previas (si existen)
DROP POLICY IF EXISTS "user_projects_select_if_participant" ON public.user_projects;
DROP POLICY IF EXISTS "user_projects_insert_if_owner_or_self" ON public.user_projects;
DROP POLICY IF EXISTS "user_projects_delete_if_owner_or_self" ON public.user_projects;

-- 3) Política de lectura
-- Un usuario puede ver participantes de proyectos en los que está vinculado.
CREATE POLICY "user_projects_select_if_participant"
ON public.user_projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_projects up
    WHERE up.project_id = user_projects.project_id
      AND up.user_id::text = auth.uid()::text
  )
);

-- 4) Política de inserción
-- Permite insertar vínculo si:
-- a) el vínculo es para sí mismo, o
-- b) el usuario autenticado ya es autor del proyecto (puede agregar coautores)
CREATE POLICY "user_projects_insert_if_owner_or_self"
ON public.user_projects
FOR INSERT
TO authenticated
WITH CHECK (
  user_id::text = auth.uid()::text
  OR EXISTS (
    SELECT 1
    FROM public.user_projects up
    WHERE up.project_id = user_projects.project_id
      AND up.user_id::text = auth.uid()::text
      AND COALESCE(up.project_role, 'autor') = 'autor'
  )
);

-- 5) Política de eliminación
-- Permite quitar vínculos si:
-- a) elimina su propio vínculo, o
-- b) es autor del proyecto
CREATE POLICY "user_projects_delete_if_owner_or_self"
ON public.user_projects
FOR DELETE
TO authenticated
USING (
  user_id::text = auth.uid()::text
  OR EXISTS (
    SELECT 1
    FROM public.user_projects up
    WHERE up.project_id = user_projects.project_id
      AND up.user_id::text = auth.uid()::text
      AND COALESCE(up.project_role, 'autor') = 'autor'
  )
);
