-- Fechas administrativas para controlar el cierre de cada semestre.
-- No elimina datos ni modifica las relaciones de estudiantes.

ALTER TABLE public.semesters
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE;
