-- ============================================================
-- Migración: Banco de Proyectos e Historial de Trazabilidad
-- Tablas: public.project_bank, public.project_bank_histories
-- Fecha: 2026-09-04
-- ============================================================

-- 1. TABLA BANCO DE PROYECTOS
CREATE TABLE IF NOT EXISTS public.project_bank (
    project_bank_id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    description TEXT NOT NULL,
    general_objective TEXT,
    specific_objectives TEXT,
    research_line_id INTEGER REFERENCES public.research_lines(research_line_id),
    research_subline_id INTEGER REFERENCES public.research_sublines(research_subline_id),
    program_id INTEGER REFERENCES public.programs(program_id),
    keywords VARCHAR(300),
    observations TEXT,
    proposer_id VARCHAR(50) NOT NULL REFERENCES public.users(user_id),
    proposer_role VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Disponible',
    assigned_student_id VARCHAR(50) REFERENCES public.users(user_id),
    assigned_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar búsquedas por programa, estado y proponente
CREATE INDEX IF NOT EXISTS idx_project_bank_program_id ON public.project_bank(program_id);
CREATE INDEX IF NOT EXISTS idx_project_bank_status ON public.project_bank(status);
CREATE INDEX IF NOT EXISTS idx_project_bank_assigned_student ON public.project_bank(assigned_student_id);
CREATE INDEX IF NOT EXISTS idx_project_bank_proposer ON public.project_bank(proposer_id);

-- 2. TABLA HISTORIAL DE TRAZABILIDAD DEL BANCO DE PROYECTOS
CREATE TABLE IF NOT EXISTS public.project_bank_histories (
    project_bank_history_id SERIAL PRIMARY KEY,
    project_bank_id INTEGER NOT NULL REFERENCES public.project_bank(project_bank_id) ON DELETE RESTRICT,
    user_id VARCHAR(50) NOT NULL REFERENCES public.users(user_id),
    action VARCHAR(50) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    changes JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pb_histories_project_id ON public.project_bank_histories(project_bank_id);
CREATE INDEX IF NOT EXISTS idx_pb_histories_user_id ON public.project_bank_histories(user_id);
