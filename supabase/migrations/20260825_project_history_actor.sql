-- Guarda el usuario responsable de cada cambio del proyecto.
ALTER TABLE public.histories
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES public.users(user_id);

CREATE INDEX IF NOT EXISTS idx_histories_user_id
  ON public.histories(user_id);
