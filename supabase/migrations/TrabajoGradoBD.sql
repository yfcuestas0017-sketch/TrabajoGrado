-- ============================================================
-- TrabajoGradoBD - Esquema para Supabase
-- Pegar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- FUNCIÓN DE AUDITORÍA
CREATE OR REPLACE FUNCTION public.log_project_field_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    hist_id INT;
BEGIN
    IF (OLD.status_id IS DISTINCT FROM NEW.status_id) THEN
        INSERT INTO histories (description, modified_field, old_value, new_value, change_type)
        VALUES ('Status update', 'status_id', OLD.status_id::text, NEW.status_id::text, 'UPDATE')
        RETURNING history_id INTO hist_id;
        INSERT INTO project_histories (project_id, history_id) VALUES (NEW.project_id, hist_id);
    END IF;
    IF (OLD.title IS DISTINCT FROM NEW.title) THEN
        INSERT INTO histories (description, modified_field, old_value, new_value, change_type)
        VALUES ('Title modification', 'title', OLD.title, NEW.title, 'UPDATE')
        RETURNING history_id INTO hist_id;
        INSERT INTO project_histories (project_id, history_id) VALUES (NEW.project_id, hist_id);
    END IF;
    RETURN NEW;
END;
$$;

-- TABLAS

CREATE TABLE public.faculties (
    faculty_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE public.programs (
    program_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    faculty_id INTEGER REFERENCES public.faculties(faculty_id)
);

CREATE TABLE public.academic_curricula (
    curriculum_id SERIAL PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES public.programs(program_id),
    version VARCHAR(20) NOT NULL,
    effective_year INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    total_semesters INTEGER NOT NULL
);

CREATE TABLE public.semesters (
    semester_id SERIAL PRIMARY KEY,
    semester_number INTEGER NOT NULL
);

CREATE TABLE public.periods (
    period_id SERIAL PRIMARY KEY,
    academic_year INTEGER NOT NULL,
    period_number INTEGER NOT NULL,
    description VARCHAR(50),
    CONSTRAINT chk_period_number CHECK (period_number = ANY (ARRAY[1, 2])),
    CONSTRAINT unique_year_period UNIQUE (academic_year, period_number)
);

CREATE TABLE public.permissions (
    permission_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE public.roles (
    role_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE public.users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    program_id INTEGER REFERENCES public.programs(program_id)
);

CREATE TABLE public.modalities (
    modality_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE public.statuses (
    status_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE public.research_lines (
    research_line_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE public.research_sublines (
    research_subline_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    research_line_id INTEGER REFERENCES public.research_lines(research_line_id)
);

CREATE TABLE public.histories (
    history_id SERIAL PRIMARY KEY,
    description TEXT,
    modified_field VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR(50),
    changed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.projects (
    project_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITHOUT TIME ZONE,
    letter_link VARCHAR(255),
    research_line_id INTEGER REFERENCES public.research_lines(research_line_id),
    research_subline_id INTEGER REFERENCES public.research_sublines(research_subline_id),
    status_id INTEGER REFERENCES public.statuses(status_id),
    modality_id INTEGER REFERENCES public.modalities(modality_id)
);

CREATE TABLE public.project_histories (
    project_history_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES public.projects(project_id),
    history_id INTEGER REFERENCES public.histories(history_id)
);

CREATE TABLE public.students (
    student_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(user_id),
    semester_id INTEGER NOT NULL REFERENCES public.semesters(semester_id),
    curriculum_id INTEGER NOT NULL REFERENCES public.academic_curricula(curriculum_id)
);

CREATE TABLE public.user_projects (
    user_project_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES public.projects(project_id),
    user_id INTEGER REFERENCES public.users(user_id),
    started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.user_roles (
    user_role_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(user_id),
    role_id INTEGER REFERENCES public.roles(role_id),
    assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.role_permissions (
    role_permission_id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES public.roles(role_id),
    permission_id INTEGER REFERENCES public.permissions(permission_id)
);

CREATE TABLE public.program_periods (
    program_period_id SERIAL PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES public.programs(program_id),
    period_id INTEGER NOT NULL REFERENCES public.periods(period_id)
);

-- TRIGGER DE AUDITORÍA
CREATE TRIGGER trg_audit_projects
AFTER UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.log_project_field_changes();
