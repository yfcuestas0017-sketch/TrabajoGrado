-- Registros académicos del mismo proyecto durante Investigación II y III.
-- No modifica ni elimina estructuras existentes.

CREATE TABLE IF NOT EXISTS public.research_progress (
    progress_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(project_id),
    user_id VARCHAR(255) NOT NULL REFERENCES public.users(user_id),
    description TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public.research_documents (
    document_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(project_id),
    user_id VARCHAR(255) NOT NULL REFERENCES public.users(user_id),
    document_type VARCHAR(50) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    observations TEXT,
    delivered_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_progress_project_id
    ON public.research_progress(project_id);

CREATE INDEX IF NOT EXISTS idx_research_documents_project_id
    ON public.research_documents(project_id);
