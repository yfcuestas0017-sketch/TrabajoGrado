-- Restaura la generación automática del identificador de user_projects.
-- No elimina ni modifica relaciones existentes.

SELECT setval(
    'public.user_projects_user_project_id_seq',
    COALESCE((SELECT MAX(user_project_id) FROM public.user_projects), 0) + 1,
    false
);

ALTER TABLE public.user_projects
    ALTER COLUMN user_project_id SET DEFAULT nextval('public.user_projects_user_project_id_seq'::regclass);

ALTER SEQUENCE public.user_projects_user_project_id_seq
    OWNED BY public.user_projects.user_project_id;
