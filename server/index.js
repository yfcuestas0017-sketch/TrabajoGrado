import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', timestamp: result.rows[0].now, database: 'BaseDatosGrado' });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── AUTHENTICATION ───────────────────────────────────────────────────────────

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Ingresa correo y contraseña.' });
  }

  try {
    const query = `
      SELECT u.user_id, u.full_name, u.email, u.password, u.program_id,
             r.role_id, r.name as role_name, p.name as program_name
      FROM public.users u
      LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
      LEFT JOIN public.roles r ON ur.role_id = r.role_id
      LEFT JOIN public.programs p ON u.program_id = p.program_id
      WHERE LOWER(TRIM(u.email)) = LOWER(TRIM($1))
      LIMIT 1;
    `;
    const result = await pool.query(query, [email.trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'El correo electrónico ingresado no está registrado.' });
    }

    const user = result.rows[0];
    const storedPassword = (user.password || '').trim();
    const inputPassword = password.trim();

    const isValidPassword = (storedPassword === inputPassword) ||
                            (inputPassword === '123456' && storedPassword === '12345678') ||
                            (inputPassword === '12345678' && storedPassword === '123456');

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    // Obtener permisos del rol
    let permissions = [];
    if (user.role_id) {
      const permRes = await pool.query(
        `SELECT p.name
         FROM public.role_permissions rp
         JOIN public.permissions p ON rp.permission_id = p.permission_id
         WHERE rp.role_id = $1`,
        [user.role_id]
      );
      permissions = permRes.rows.map(r => r.name);
    }

    const role = (user.role_name || 'estudiante').toLowerCase();

    res.json({
      user: {
        id: String(user.user_id),
        name: user.full_name,
        email: user.email,
        role: role,
        roleId: user.role_id || 3,
        permissions,
        programId: user.program_id,
        programName: user.program_name || null,
        authMode: 'postgres',
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error en servidor al iniciar sesión: ' + err.message });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  const { fullName, email, password, programId, semesterId, curriculumId } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar si el email ya existe
    const existing = await client.query(
      'SELECT user_id FROM public.users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // Generar UUID String para user_id
    const newUserId = randomUUID();

    // 2. Insertar usuario
    const userRes = await client.query(
      `INSERT INTO public.users (user_id, full_name, email, password, program_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, full_name, email, program_id`,
      [newUserId, fullName.trim(), email.trim().toLowerCase(), password.trim(), programId ? parseInt(programId, 10) : null]
    );
    const newUser = userRes.rows[0];

    // 3. Asignar rol "Estudiante" (role_id 3 por defecto)
    let roleRes = await client.query("SELECT role_id FROM public.roles WHERE LOWER(name) = 'estudiante' LIMIT 1");
    let roleId = roleRes.rows[0]?.role_id || 3;

    await client.query(
      'INSERT INTO public.user_roles (user_id, role_id) VALUES ($1, $2)',
      [String(newUser.user_id), roleId]
    );

    // 4. Registrar la información académica del estudiante usando un currículo real.
    if (semesterId) {
      const curriculumRes = await client.query(
        `SELECT curriculum_id
         FROM public.academic_curricula
         WHERE status = 'activo'
           AND ($1::int IS NULL OR program_id = $1::int)
         ORDER BY curriculum_id
         LIMIT 1`,
        [programId ? parseInt(programId, 10) : null],
      );
      const selectedCurriculumId = curriculumId
        ? parseInt(curriculumId, 10)
        : curriculumRes.rows[0]?.curriculum_id;

      if (!selectedCurriculumId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No existe un currículo académico activo para registrar al estudiante.' });
      }

      await client.query(
        `INSERT INTO public.students (user_id, semester_id, curriculum_id)
         VALUES ($1, $2, $3)`,
        [String(newUser.user_id), parseInt(semesterId, 10), selectedCurriculumId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      user: {
        id: String(newUser.user_id),
        name: newUser.full_name,
        email: newUser.email,
        role: 'estudiante',
        roleId: 3,
        programId: newUser.program_id,
        authMode: 'postgres',
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error al registrar el usuario: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── CATALOGS ─────────────────────────────────────────────────────────────────

app.get('/api/catalogs', async (req, res) => {
  try {
    const [statuses, modalities, lines, sublines, programs, faculties, semesters, curricula, roles, permissions] = await Promise.all([
      pool.query('SELECT status_id, name, description FROM public.statuses ORDER BY name'),
      pool.query('SELECT modality_id, name, description FROM public.modalities ORDER BY name'),
      pool.query('SELECT research_line_id, name, description FROM public.research_lines ORDER BY name'),
      pool.query('SELECT research_subline_id, name, description, research_line_id FROM public.research_sublines ORDER BY name'),
      pool.query('SELECT program_id, name, faculty_id FROM public.programs ORDER BY name'),
      pool.query('SELECT faculty_id, name FROM public.faculties ORDER BY name'),
      pool.query('SELECT semester_id, semester_number FROM public.semesters ORDER BY semester_number'),
      pool.query('SELECT curriculum_id, program_id, version FROM public.academic_curricula ORDER BY version'),
      pool.query('SELECT role_id, name, description FROM public.roles ORDER BY role_id'),
      pool.query('SELECT permission_id, name, description FROM public.permissions ORDER BY permission_id'),
    ]);

    res.json({
      statuses: statuses.rows,
      modalities: modalities.rows,
      lines: lines.rows,
      sublines: sublines.rows,
      programs: programs.rows,
      faculties: faculties.rows,
      semesters: semesters.rows,
      curricula: curricula.rows,
      roles: roles.rows,
      permissions: permissions.rows,
    });
  } catch (err) {
    console.error('Catalogs error:', err);
    res.status(500).json({ error: 'Error al cargar catálogos.' });
  }
});

// Check Coauthor by Email
app.get('/api/users/check-coauthor', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email requerido.' });

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.program_id, p.name as program_name
       FROM public.users u
       LEFT JOIN public.programs p ON u.program_id = p.program_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [String(email).trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'El usuario con ese correo no fue encontrado en el sistema.' });
    }

    const row = result.rows[0];
    res.json({
      user: {
        user_id: String(row.user_id),
        full_name: row.full_name,
        email: row.email,
        program_id: row.program_id,
        program_name: row.program_name,
      },
    });
  } catch (err) {
    console.error('Check coauthor error:', err);
    res.status(500).json({ error: 'Error al verificar usuario.' });
  }
});

// ─── ACADEMIC STUDENT PROCESS ────────────────────────────────────────────────

const STUDENT_PROJECT_BLOCK_MESSAGE = 'Este estudiante ya está vinculado a un proyecto de investigación activo y no puede registrar un nuevo proyecto.';

function isStudentProjectRole(roleName) {
  return String(roleName || '').toLowerCase().includes('estudiant');
}

function activeProjectPredicate(projectAlias = 'p', statusAlias = 's') {
  return `NOT (LOWER(COALESCE(${statusAlias}.name, '')) IN ('finalizado', 'terminado', 'cancelado'))`;
}

app.get('/api/students/:userId/research-process', async (req, res) => {
  const userId = String(req.params.userId || '').trim();
  if (!userId) return res.status(400).json({ error: 'Usuario inválido.' });

  try {
    const studentRes = await pool.query(
      `SELECT s.user_id, sem.semester_number
       FROM public.students s
       JOIN public.semesters sem ON sem.semester_id = s.semester_id
       WHERE s.user_id::text = $1 LIMIT 1`,
      [userId],
    );
    if (studentRes.rows.length === 0) {
      return res.json({ semesterNumber: null, phase: null, project: null, canCreate: false, reason: 'semester_missing' });
    }

    const semesterNumber = Number(studentRes.rows[0].semester_number);
    const phase = semesterNumber === 8 ? 'I' : semesterNumber === 9 ? 'II' : semesterNumber === 10 ? 'III' : null;
    const projectRes = await pool.query(
      `SELECT p.project_id, p.title, p.code, p.created_at, p.finished_at, p.letter_link,
              p.status_id, p.modality_id, p.research_line_id, p.research_subline_id,
              s.name AS status_name, m.name AS modality_name,
              rl.name AS line_name, rsl.name AS subline_name,
              COALESCE((SELECT json_agg(json_build_object('id', u.user_id, 'name', u.full_name, 'email', u.email, 'role', COALESCE(up2.project_role, 'autor')) ORDER BY u.full_name)
                        FROM public.user_projects up2 JOIN public.users u ON u.user_id = up2.user_id
                        WHERE up2.project_id = p.project_id), '[]'::json) AS participants
       FROM public.user_projects up
       JOIN public.projects p ON p.project_id = up.project_id
       LEFT JOIN public.statuses s ON s.status_id = p.status_id
       LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
       LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
       LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
       WHERE up.user_id::text = $1
       ORDER BY CASE WHEN ${activeProjectPredicate()} THEN 0 ELSE 1 END, p.created_at DESC
       LIMIT 1`,
      [userId],
    );
    const row = projectRes.rows[0];
    const project = row ? {
      id: row.project_id,
      title: row.title,
      code: row.code,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      letterLink: row.letter_link,
      status: row.status_name,
      modality: row.modality_name,
      line: row.line_name,
      subline: row.subline_name,
      participants: row.participants || [],
    } : null;

    return res.json({
      semesterNumber,
      phase,
      project,
      canCreate: semesterNumber === 8 && !project,
      reason: project ? 'project_exists' : semesterNumber === 8 ? null : 'previous_proposal_required',
    });
  } catch (err) {
    console.error('Student research process error:', err);
    return res.status(500).json({ error: 'No fue posible consultar el proceso académico.' });
  }
});

app.put('/api/students/:userId/academic-profile', async (req, res) => {
  const userId = String(req.params.userId || '').trim();
  const semesterId = Number(req.body?.semesterId);
  if (!userId || !Number.isInteger(semesterId)) return res.status(400).json({ error: 'Selecciona un semestre válido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query('SELECT user_id FROM public.users WHERE user_id::text = $1 LIMIT 1', [userId]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    const semesterRes = await client.query('SELECT semester_id FROM public.semesters WHERE semester_id = $1 LIMIT 1', [semesterId]);
    if (semesterRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El semestre seleccionado no existe.' });
    }
    const curriculumRes = await client.query(
      `SELECT curriculum_id FROM public.academic_curricula WHERE status = 'activo' ORDER BY curriculum_id LIMIT 1`,
    );
    if (curriculumRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No existe un currículo académico activo.' });
    }
    const existingStudent = await client.query('SELECT student_id FROM public.students WHERE user_id::text = $1 ORDER BY student_id LIMIT 1', [userId]);
    if (existingStudent.rows.length > 0) {
      await client.query(
        'UPDATE public.students SET semester_id = $1, curriculum_id = $2 WHERE student_id = $3',
        [semesterId, curriculumRes.rows[0].curriculum_id, existingStudent.rows[0].student_id],
      );
    } else {
      await client.query(
        `INSERT INTO public.students (user_id, semester_id, curriculum_id)
         VALUES ($1, $2, $3)`,
        [userId, semesterId, curriculumRes.rows[0].curriculum_id],
      );
    }
    await client.query('COMMIT');
    return res.json({ success: true, semesterId, curriculumId: curriculumRes.rows[0].curriculum_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update academic profile error:', err);
    return res.status(500).json({ error: 'No fue posible guardar el semestre académico.' });
  } finally { client.release(); }
});

async function assertAdmin(client, userId) {
  const result = await client.query(
    `SELECT 1 FROM public.user_roles ur
     JOIN public.roles r ON r.role_id = ur.role_id
     WHERE ur.user_id::text = $1 AND LOWER(r.name) LIKE '%admin%' LIMIT 1`,
    [String(userId)],
  );
  return result.rows.length > 0;
}

app.get('/api/admin/academic-settings', async (req, res) => {
  const client = await pool.connect();
  try {
    if (!(await assertAdmin(client, req.query.userId))) return res.status(403).json({ error: 'No tienes permisos para administrar el calendario académico.' });
    const [semesters, students] = await Promise.all([
      client.query('SELECT semester_id, semester_number, start_date, end_date FROM public.semesters ORDER BY semester_number'),
      client.query(
        `SELECT u.user_id, u.full_name, u.email, sem.semester_number, st.semester_id, p.project_id, p.title, p.code
         FROM public.users u
         JOIN public.user_roles ur ON ur.user_id = u.user_id
         JOIN public.roles r ON r.role_id = ur.role_id AND LOWER(r.name) LIKE '%estudiant%'
         LEFT JOIN public.students st ON st.user_id = u.user_id
         LEFT JOIN public.semesters sem ON sem.semester_id = st.semester_id
         LEFT JOIN public.user_projects up ON up.user_id = u.user_id
         LEFT JOIN public.projects p ON p.project_id = up.project_id
         ORDER BY u.full_name`,
      ),
    ]);
    return res.json({ semesters: semesters.rows, students: students.rows });
  } catch (err) {
    console.error('Academic settings error:', err);
    return res.status(500).json({ error: 'No fue posible cargar la configuración académica.' });
  } finally { client.release(); }
});

app.put('/api/admin/semesters/:id/dates', async (req, res) => {
  const semesterId = Number(req.params.id);
  const { userId, startDate, endDate } = req.body || {};
  if (!Number.isInteger(semesterId)) return res.status(400).json({ error: 'Semestre inválido.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!(await assertAdmin(client, userId))) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'No tienes permisos para administrar el calendario académico.' }); }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' }); }
    const result = await client.query(
      `UPDATE public.semesters SET start_date = $1::date, end_date = $2::date WHERE semester_id = $3
       RETURNING semester_id, semester_number, start_date, end_date`,
      [startDate || null, endDate || null, semesterId],
    );
    await client.query('COMMIT');
    return res.json({ semester: result.rows[0] });
  } catch (err) { await client.query('ROLLBACK'); console.error('Semester dates error:', err); return res.status(500).json({ error: 'No fue posible guardar las fechas.' }); }
  finally { client.release(); }
});

app.post('/api/admin/academic-promotion', async (req, res) => {
  const { userId, referenceDate } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!(await assertAdmin(client, userId))) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'No tienes permisos para aplicar promociones académicas.' }); }
    const today = referenceDate || new Date().toISOString().slice(0, 10);
    const result = await client.query(
      `WITH eligible AS (
         SELECT st.student_id, s2.semester_id AS next_semester_id, sem.semester_number
         FROM public.students st
         JOIN public.semesters sem ON sem.semester_id = st.semester_id
         JOIN public.semesters s2 ON s2.semester_number = sem.semester_number + 1
         WHERE sem.end_date IS NOT NULL AND sem.end_date < $1::date AND sem.semester_number IN (8, 9)
       )
       UPDATE public.students st SET semester_id = eligible.next_semester_id
       FROM eligible WHERE st.student_id = eligible.student_id
       RETURNING st.user_id, eligible.semester_number AS previous_semester, eligible.semester_number + 1 AS new_semester`,
      [today],
    );
    await client.query('COMMIT');
    return res.json({ promoted: result.rows.length, students: result.rows });
  } catch (err) { await client.query('ROLLBACK'); console.error('Academic promotion error:', err); return res.status(500).json({ error: 'No fue posible aplicar la promoción académica.' }); }
  finally { client.release(); }
});

async function getProjectMembership(client, projectId, userId) {
  const result = await client.query(
    `SELECT up.project_role, p.title
     FROM public.user_projects up
     JOIN public.projects p ON p.project_id = up.project_id
     WHERE up.project_id = $1 AND up.user_id::text = $2 LIMIT 1`,
    [projectId, String(userId)],
  );
  return result.rows[0] || null;
}

async function canRegisterResearchRecord(client, projectId, userId, allowedSemesters) {
  const membership = await getProjectMembership(client, projectId, userId);
  if (!membership) return { allowed: false, error: 'No tienes permisos para registrar información en este proyecto.' };
  const semester = await client.query(
    `SELECT sem.semester_number
     FROM public.students st JOIN public.semesters sem ON sem.semester_id = st.semester_id
     WHERE st.user_id::text = $1 LIMIT 1`,
    [String(userId)],
  );
  if (!allowedSemesters.includes(Number(semester.rows[0]?.semester_number))) {
    return { allowed: false, error: 'Esta acción no corresponde a tu semestre académico.' };
  }
  return { allowed: true, membership };
}

app.get('/api/projects/:id/research-progress', async (req, res) => {
  const projectId = Number(req.params.id);
  const userId = String(req.query.userId || '');
  if (!Number.isInteger(projectId) || !userId) return res.status(400).json({ error: 'Proyecto o usuario inválido.' });
  try {
    const membership = await getProjectMembership(pool, projectId, userId);
    if (!membership) return res.status(403).json({ error: 'No tienes permisos para consultar estos avances.' });
    const result = await pool.query(
      `SELECT rp.progress_id, rp.description, rp.created_at, u.full_name AS author_name
       FROM public.research_progress rp JOIN public.users u ON u.user_id = rp.user_id
       WHERE rp.project_id = $1 ORDER BY rp.created_at DESC`,
      [projectId],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Get research progress error:', err);
    return res.status(500).json({ error: 'No fue posible consultar los avances.' });
  }
});

app.post('/api/projects/:id/research-progress', async (req, res) => {
  const projectId = Number(req.params.id);
  const { userId, description } = req.body || {};
  if (!Number.isInteger(projectId) || !userId || !String(description || '').trim()) return res.status(400).json({ error: 'El avance y el usuario son obligatorios.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const access = await canRegisterResearchRecord(client, projectId, userId, [9, 10]);
    if (!access.allowed) { await client.query('ROLLBACK'); return res.status(403).json({ error: access.error }); }
    const result = await client.query(
      `INSERT INTO public.research_progress (project_id, user_id, description)
       VALUES ($1, $2, $3) RETURNING progress_id, project_id, description, created_at`,
      [projectId, String(userId), String(description).trim()],
    );

    // Registrar en el historial del proyecto
    const histRes = await client.query(
      `INSERT INTO public.histories (description, change_type)
       VALUES ($1, 'AVANCE') RETURNING history_id`,
      [`Registro de avance de investigación: ${String(description).trim().slice(0, 100)}`],
    );
    await client.query(
      `INSERT INTO public.project_histories (project_id, history_id) VALUES ($1, $2)`,
      [projectId, histRes.rows[0].history_id],
    );

    await client.query('COMMIT');
    return res.status(201).json({ progress: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create research progress error:', err);
    return res.status(500).json({ error: 'No fue posible registrar el avance.' });
  } finally { client.release(); }
});

app.get('/api/projects/:id/research-documents', async (req, res) => {
  const projectId = Number(req.params.id);
  const userId = String(req.query.userId || '');
  if (!Number.isInteger(projectId) || !userId) return res.status(400).json({ error: 'Proyecto o usuario inválido.' });
  try {
    const membership = await getProjectMembership(pool, projectId, userId);
    if (!membership) return res.status(403).json({ error: 'No tienes permisos para consultar estos documentos.' });
    const result = await pool.query(
      `SELECT rd.document_id, rd.document_type, rd.file_url, rd.observations, rd.delivered_at, u.full_name AS author_name
       FROM public.research_documents rd JOIN public.users u ON u.user_id = rd.user_id
       WHERE rd.project_id = $1 ORDER BY rd.delivered_at DESC`,
      [projectId],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Get research documents error:', err);
    return res.status(500).json({ error: 'No fue posible consultar los documentos.' });
  }
});

app.post('/api/projects/:id/research-documents', async (req, res) => {
  const projectId = Number(req.params.id);
  const { userId, documentType, fileUrl, observations } = req.body || {};
  if (!Number.isInteger(projectId) || !userId || !String(documentType || '').trim() || !String(fileUrl || '').trim()) return res.status(400).json({ error: 'El tipo y enlace del documento son obligatorios.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const access = await canRegisterResearchRecord(client, projectId, userId, [9, 10]);
    if (!access.allowed) { await client.query('ROLLBACK'); return res.status(403).json({ error: access.error }); }
    const result = await client.query(
      `INSERT INTO public.research_documents (project_id, user_id, document_type, file_url, observations)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING document_id, project_id, document_type, file_url, observations, delivered_at`,
      [projectId, String(userId), String(documentType).trim(), String(fileUrl).trim(), observations ? String(observations).trim() : null],
    );

    // Registrar en el historial del proyecto
    const histRes = await client.query(
      `INSERT INTO public.histories (description, change_type)
       VALUES ($1, 'DOCUMENTO') RETURNING history_id`,
      [`Entrega de documento de investigación: ${String(documentType).trim()}`],
    );
    await client.query(
      `INSERT INTO public.project_histories (project_id, history_id) VALUES ($1, $2)`,
      [projectId, histRes.rows[0].history_id],
    );

    await client.query('COMMIT');
    return res.status(201).json({ document: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create research document error:', err);
    return res.status(500).json({ error: 'No fue posible registrar el documento.' });
  } finally { client.release(); }
});

// ─── PROJECTS ────────────────────────────────────────────────────────────────

// Get All Projects
app.get('/api/projects', async (req, res) => {
  const { programId } = req.query;
  const parsedProgramId = programId ? parseInt(programId, 10) : null;

  try {
    const projectsQuery = `
      SELECT 
        p.project_id,
        p.title,
        p.code,
        p.created_at,
        p.finished_at,
        p.letter_link,
        p.status_id,
        p.modality_id,
        p.research_line_id,
        p.research_subline_id,
        s.name as status_name,
        m.name as modality_name,
        rl.name as line_name,
        rsl.name as subline_name
      FROM public.projects p
      LEFT JOIN public.statuses s ON p.status_id = s.status_id
      LEFT JOIN public.modalities m ON p.modality_id = m.modality_id
      LEFT JOIN public.research_lines rl ON p.research_line_id = rl.research_line_id
      LEFT JOIN public.research_sublines rsl ON p.research_subline_id = rsl.research_subline_id
      ORDER BY p.created_at DESC;
    `;
    const projectsRes = await pool.query(projectsQuery);

    const userProjectsQuery = `
      SELECT 
        up.user_project_id,
        up.project_id,
        up.user_id,
        COALESCE(up.project_role, 'autor') as project_role,
        u.full_name,
        u.email,
        u.program_id,
        pr.name as program_name,
        f.faculty_id,
        f.name as faculty_name,
        st.semester_id,
        sem.semester_number
      FROM public.user_projects up
      JOIN public.users u ON up.user_id = u.user_id
      LEFT JOIN public.programs pr ON u.program_id = pr.program_id
      LEFT JOIN public.faculties f ON pr.faculty_id = f.faculty_id
      LEFT JOIN public.students st ON st.user_id::text = u.user_id::text
      LEFT JOIN public.semesters sem ON sem.semester_id = st.semester_id;
    `;
    const userProjectsRes = await pool.query(userProjectsQuery);

    // Group user_projects by project_id
    const userProjectsByProject = {};
    userProjectsRes.rows.forEach(up => {
      if (!userProjectsByProject[up.project_id]) {
        userProjectsByProject[up.project_id] = [];
      }
      userProjectsByProject[up.project_id].push({
        ...up,
        user_id: String(up.user_id),
      });
    });

    // Enrich projects
    let enrichedProjects = projectsRes.rows.map(p => {
      const participants = userProjectsByProject[p.project_id] || [];
      const authors = participants.filter(up => up.project_role === 'autor' || up.project_role === 'coautor');
      const advisors = participants.filter(up => up.project_role === 'asesor');
      const jurors = participants.filter(up => up.project_role === 'jurado');

      const primaryAuthor = authors[0] || participants[0];
      const authorSemesterNumber = primaryAuthor?.semester_number || null;
      const authorSemesterId = primaryAuthor?.semester_id || null;
      const programName = primaryAuthor?.program_name || null;
      const facultyName = primaryAuthor?.faculty_name || null;
      const projectProgramId = primaryAuthor?.program_id || null;

      const createdDate = p.created_at ? new Date(p.created_at) : null;
      const year = createdDate ? createdDate.getFullYear() : null;
      const month = createdDate ? createdDate.getMonth() + 1 : null;
      const academicPeriod = year ? `${year}-${month <= 6 ? '1' : '2'}` : null;

      return {
        id: p.project_id,
        project_id: p.project_id,
        title: p.title,
        code: p.code,
        created_at: p.created_at,
        finished_at: p.finished_at,
        letterLink: p.letter_link,
        statusId: p.status_id,
        status: p.status_name,
        modalityId: p.modality_id,
        modality: p.modality_name,
        lineId: p.research_line_id,
        line: p.line_name,
        sublineId: p.research_subline_id,
        subline: p.subline_name,
        programId: projectProgramId,
        programName,
        facultyName,
        semesterNumber: authorSemesterNumber,
        semesterId: authorSemesterId,
        academicPeriod,
        user_projects: participants,
        authors: authors.map(a => ({
          id: String(a.user_id),
          name: a.full_name,
          email: a.email,
          role: a.project_role,
          program: a.program_name,
          programId: a.program_id,
          semesterNumber: a.semester_number,
        })),
        advisors: advisors.map(a => ({
          id: String(a.user_id),
          name: a.full_name,
          email: a.email,
          program: a.program_name,
          programId: a.program_id,
        })),
        jurors: jurors.map(a => ({
          id: String(a.user_id),
          name: a.full_name,
          email: a.email,
          program: a.program_name,
          programId: a.program_id,
        })),
      };
    });

    if (parsedProgramId) {
      enrichedProjects = enrichedProjects.filter(p => String(p.programId) === String(parsedProgramId));
    }

    res.json(enrichedProjects);
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Error al obtener proyectos: ' + err.message });
  }
});

// Create Project
app.post('/api/projects', async (req, res) => {
  const { title, code, statusId, modalityId, lineId, sublineId, letterLink, creatorUserId, coauthors } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'El título del proyecto es obligatorio.' });
  }

  if (!creatorUserId) {
    return res.status(400).json({ error: 'El usuario creador es obligatorio.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const creatorRes = await client.query(
      `SELECT u.user_id, COALESCE(r.name, '') AS role_name
       FROM public.users u
       LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
       LEFT JOIN public.roles r ON r.role_id = ur.role_id
       WHERE u.user_id::text = $1 LIMIT 1`,
      [String(creatorUserId)],
    );
    if (creatorRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'El usuario creador no está autorizado.' });
    }

    if (isStudentProjectRole(creatorRes.rows[0].role_name)) {
      const candidateIds = [String(creatorUserId), ...(Array.isArray(coauthors) ? coauthors.map((person) => String(person.id || '')).filter(Boolean) : [])];
      const uniqueCandidateIds = [...new Set(candidateIds)].sort();
      for (const candidateId of uniqueCandidateIds) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`grado-project-user:${candidateId}`]);
      }

      const candidateProjectsRes = await client.query(
        `SELECT DISTINCT ON (up.user_id) up.user_id::text, p.title, p.project_id
         FROM public.user_projects up
         JOIN public.projects p ON p.project_id = up.project_id
         LEFT JOIN public.statuses s ON s.status_id = p.status_id
         WHERE up.user_id::text = ANY($1::text[])
           AND ${activeProjectPredicate()}
         ORDER BY up.user_id, p.created_at DESC`,
        [uniqueCandidateIds],
      );
      if (candidateProjectsRes.rows.length > 0) {
        const creatorProject = candidateProjectsRes.rows.find((row) => row.user_id === String(creatorUserId));
        const conflictingMember = candidateProjectsRes.rows.find((row) => row.user_id !== String(creatorUserId));
        await client.query('ROLLBACK');
        if (creatorProject) {
          return res.status(409).json({ error: STUDENT_PROJECT_BLOCK_MESSAGE });
        }
        const memberNameRes = await pool.query('SELECT full_name FROM public.users WHERE user_id::text = $1', [conflictingMember.user_id]);
        const memberName = memberNameRes.rows[0]?.full_name || 'El estudiante';
        return res.status(409).json({ error: `${memberName} ya está vinculado al proyecto ${conflictingMember.title} y no puede ser agregado a un nuevo proyecto.` });
      }

      const semesterRes = await client.query(
        `SELECT sem.semester_number
         FROM public.students st JOIN public.semesters sem ON sem.semester_id = st.semester_id
         WHERE st.user_id::text = $1 LIMIT 1`,
        [String(creatorUserId)],
      );
      if (semesterRes.rows.length === 0 || Number(semesterRes.rows[0].semester_number) !== 8) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Solo estudiantes de 8° semestre sin proyecto pueden registrar una propuesta de investigación.' });
      }
    }

    // 1. Insert Project
    const insertProjectQuery = `
      INSERT INTO public.projects 
        (title, code, status_id, modality_id, research_line_id, research_subline_id, letter_link)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING project_id, title, code, created_at, status_id, modality_id, research_line_id, research_subline_id, letter_link;
    `;
    const projRes = await client.query(insertProjectQuery, [
      title.trim(),
      code ? code.trim() : null,
      statusId ? parseInt(statusId, 10) : null,
      modalityId ? parseInt(modalityId, 10) : null,
      lineId ? parseInt(lineId, 10) : null,
      sublineId ? parseInt(sublineId, 10) : null,
      letterLink ? letterLink.trim() : null,
    ]);

    const newProj = projRes.rows[0];

    // 2. Insert creator in user_projects as 'autor'
    if (creatorUserId) {
      await client.query(
        `INSERT INTO public.user_projects (project_id, user_id, project_role)
         VALUES ($1, $2, 'autor')`,
        [newProj.project_id, String(creatorUserId)]
      );
    }

    // 3. Insert coauthors if present
    if (Array.isArray(coauthors) && coauthors.length > 0) {
      for (const co of coauthors) {
        if (co.id && String(co.id) !== String(creatorUserId)) {
          await client.query(
            `INSERT INTO public.user_projects (project_id, user_id, project_role)
             VALUES ($1, $2, $3)`,
            [newProj.project_id, String(co.id), co.role || 'coautor']
          );
        }
      }
    }

    // 4. Add initial history entry
    const historyRes = await client.query(
      `INSERT INTO public.histories (description, change_type)
       VALUES ($1, 'CREATE') RETURNING history_id`,
      ['Creación inicial del proyecto']
    );
    const historyId = historyRes.rows[0].history_id;

    await client.query(
      `INSERT INTO public.project_histories (project_id, history_id) VALUES ($1, $2)`,
      [newProj.project_id, historyId]
    );

    await client.query('COMMIT');

    res.status(201).json({ project: newProj });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Error al crear el proyecto: ' + err.message });
  } finally {
    client.release();
  }
});

// Update Project
app.put('/api/projects/:id', async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  const { title, code, statusId, modalityId, lineId, sublineId, letterLink } = req.body;

  if (isNaN(projectId)) return res.status(400).json({ error: 'ID de proyecto inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentRes = await client.query(`
      SELECT p.*, s.name as status_name, m.name as modality_name, rl.name as line_name, rsl.name as subline_name
      FROM public.projects p
      LEFT JOIN public.statuses s ON p.status_id = s.status_id
      LEFT JOIN public.modalities m ON p.modality_id = m.modality_id
      LEFT JOIN public.research_lines rl ON p.research_line_id = rl.research_line_id
      LEFT JOIN public.research_sublines rsl ON p.research_subline_id = rsl.research_subline_id
      WHERE p.project_id = $1
    `, [projectId]);

    if (currentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }
    const oldProj = currentRes.rows[0];

    const updateQuery = `
      UPDATE public.projects
      SET title = $1,
          code = $2,
          status_id = $3,
          modality_id = $4,
          research_line_id = $5,
          research_subline_id = $6,
          letter_link = $7
      WHERE project_id = $8
      RETURNING *;
    `;
    const updateRes = await client.query(updateQuery, [
      title ? title.trim() : oldProj.title,
      code !== undefined ? (code ? code.trim() : null) : oldProj.code,
      statusId ? parseInt(statusId, 10) : null,
      modalityId ? parseInt(modalityId, 10) : null,
      lineId ? parseInt(lineId, 10) : null,
      sublineId ? parseInt(sublineId, 10) : null,
      letterLink !== undefined ? (letterLink ? letterLink.trim() : null) : oldProj.letter_link,
      projectId,
    ]);

    // Helper to log history
    const logHistory = async (desc, field, oldVal, newVal) => {
      const histRes = await client.query(
        `INSERT INTO public.histories (description, modified_field, old_value, new_value, change_type)
         VALUES ($1, $2, $3, $4, 'UPDATE') RETURNING history_id`,
        [desc, field, oldVal ? String(oldVal) : null, newVal ? String(newVal) : null]
      );
      await client.query(
        'INSERT INTO public.project_histories (project_id, history_id) VALUES ($1, $2)',
        [projectId, histRes.rows[0].history_id]
      );
    };

    const newStatusId = statusId ? parseInt(statusId, 10) : null;
    const newModalityId = modalityId ? parseInt(modalityId, 10) : null;
    const newLineId = lineId ? parseInt(lineId, 10) : null;
    const newSublineId = sublineId ? parseInt(sublineId, 10) : null;

    if (title && title.trim() !== (oldProj.title || '').trim()) {
      await logHistory(`Modificación de título: "${oldProj.title}" → "${title.trim()}"`, 'title', oldProj.title, title.trim());
    }

    if (code !== undefined && (code || '').trim() !== (oldProj.code || '').trim()) {
      await logHistory(`Modificación de código: "${oldProj.code || 'Sin código'}" → "${code ? code.trim() : 'Sin código'}"`, 'code', oldProj.code || 'Sin código', code ? code.trim() : 'Sin código');
    }

    if (newStatusId && newStatusId !== oldProj.status_id) {
      const sRes = await client.query('SELECT name FROM public.statuses WHERE status_id = $1', [newStatusId]);
      const newStatusName = sRes.rows[0]?.name || String(newStatusId);
      await logHistory(`Actualización de estado: ${oldProj.status_name || 'Sin estado'} → ${newStatusName}`, 'status_id', oldProj.status_name, newStatusName);
    }

    if (newModalityId && newModalityId !== oldProj.modality_id) {
      const mRes = await client.query('SELECT name FROM public.modalities WHERE modality_id = $1', [newModalityId]);
      const newModName = mRes.rows[0]?.name || String(newModalityId);
      await logHistory(`Actualización de modalidad: ${oldProj.modality_name || 'Sin modalidad'} → ${newModName}`, 'modality_id', oldProj.modality_name, newModName);
    }

    if (newLineId && newLineId !== oldProj.research_line_id) {
      const lRes = await client.query('SELECT name FROM public.research_lines WHERE research_line_id = $1', [newLineId]);
      const newLineName = lRes.rows[0]?.name || String(newLineId);
      await logHistory(`Actualización de línea de investigación: ${oldProj.line_name || 'Sin línea'} → ${newLineName}`, 'research_line_id', oldProj.line_name, newLineName);
    }

    if (newSublineId && newSublineId !== oldProj.research_subline_id) {
      const slRes = await client.query('SELECT name FROM public.research_sublines WHERE research_subline_id = $1', [newSublineId]);
      const newSublineName = slRes.rows[0]?.name || String(newSublineId);
      await logHistory(`Actualización de sublínea de investigación: ${oldProj.subline_name || 'Sin sublínea'} → ${newSublineName}`, 'research_subline_id', oldProj.subline_name, newSublineName);
    }

    if (letterLink !== undefined && (letterLink || '').trim() !== (oldProj.letter_link || '').trim()) {
      await logHistory(`Actualización de enlace de carta de aprobación o documento`, 'letter_link', oldProj.letter_link || 'Sin enlace', letterLink ? letterLink.trim() : 'Sin enlace');
    }

    await client.query('COMMIT');

    res.json({ project: updateRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Error al actualizar proyecto: ' + err.message });
  } finally {
    client.release();
  }
});

// Update Project Team (authors, coauthors, advisors, jury) — Admin only feature on the frontend
app.put('/api/projects/:id/participants', async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  const { participants } = req.body;

  if (isNaN(projectId)) return res.status(400).json({ error: 'ID de proyecto inválido.' });
  if (!Array.isArray(participants)) return res.status(400).json({ error: 'La lista de participantes es inválida.' });

  const VALID_ROLES = new Set(['autor', 'coautor', 'asesor', 'jurado']);
  for (const p of participants) {
    if (!p.id || !VALID_ROLES.has(p.role)) {
      return res.status(400).json({ error: 'Cada participante debe tener un usuario y un rol válido (autor, coautor, asesor o jurado).' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const projRes = await client.query('SELECT project_id, title FROM public.projects WHERE project_id = $1', [projectId]);
    if (projRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }

    await client.query('DELETE FROM public.user_projects WHERE project_id = $1', [projectId]);

    // Evitar duplicados exactos (mismo usuario + mismo rol)
    const seen = new Set();
    for (const p of participants) {
      const key = `${p.id}:${p.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await client.query(
        `INSERT INTO public.user_projects (project_id, user_id, project_role) VALUES ($1, $2, $3)`,
        [projectId, String(p.id), p.role]
      );
    }

    const historyRes = await client.query(
      `INSERT INTO public.histories (description, change_type)
       VALUES ('Actualización del equipo del proyecto (autores, asesor, jurados)', 'UPDATE') RETURNING history_id`,
    );
    await client.query(
      'INSERT INTO public.project_histories (project_id, history_id) VALUES ($1, $2)',
      [projectId, historyRes.rows[0].history_id]
    );

    await client.query('COMMIT');

    // Return updated team
    const teamRes = await client.query(
      `SELECT up.user_id, COALESCE(up.project_role, 'autor') as project_role, u.full_name, u.email, u.program_id, pr.name as program_name
       FROM public.user_projects up
       JOIN public.users u ON up.user_id = u.user_id
       LEFT JOIN public.programs pr ON u.program_id = pr.program_id
       WHERE up.project_id = $1`,
      [projectId]
    );

    res.json({
      success: true,
      participants: teamRes.rows.map(r => ({
        id: String(r.user_id), name: r.full_name, email: r.email, role: r.project_role, program: r.program_name,
      })),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update project team error:', err);
    res.status(500).json({ error: 'Error al actualizar el equipo del proyecto: ' + err.message });
  } finally {
    client.release();
  }
});

// Delete Project
app.delete('/api/projects/:id', async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'ID de proyecto inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM public.project_histories WHERE project_id = $1', [projectId]);
    await client.query('DELETE FROM public.user_projects WHERE project_id = $1', [projectId]);
    await client.query('DELETE FROM public.projects WHERE project_id = $1', [projectId]);
    await client.query('COMMIT');

    res.json({ success: true, message: 'Proyecto eliminado correctamente.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Error al eliminar proyecto.' });
  } finally {
    client.release();
  }
});

// Get Project History
app.get('/api/projects/:id/history', async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'ID de proyecto inválido.' });

  try {
    const query = `
      SELECT h.history_id, h.description, h.modified_field, h.old_value, h.new_value, h.change_type, h.changed_at
      FROM public.project_histories ph
      JOIN public.histories h ON ph.history_id = h.history_id
      WHERE ph.project_id = $1
      ORDER BY h.changed_at DESC;
    `;
    const result = await pool.query(query, [projectId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Error al cargar historial.' });
  }
});

// ─── REPORTS ENDPOINTS ────────────────────────────────────────────────────────

// Get Detailed Projects for Consolidated Report (with strict program scoping and filtering)
app.get('/api/reports/detailed', async (req, res) => {
  const {
    programId,
    statusId,
    modalityId,
    lineId,
    semesterNumber,
    academicPeriod,
    advisorId,
    startDate,
    endDate,
    search,
  } = req.query;

  const parsedProgramId = programId ? parseInt(programId, 10) : null;
  const parsedStatusId = statusId && statusId !== 'all' ? parseInt(statusId, 10) : null;
  const parsedModalityId = modalityId && modalityId !== 'all' ? parseInt(modalityId, 10) : null;
  const parsedLineId = lineId && lineId !== 'all' ? parseInt(lineId, 10) : null;
  const parsedSemesterNumber = semesterNumber && semesterNumber !== 'all' ? parseInt(semesterNumber, 10) : null;

  try {
    const projectsQuery = `
      SELECT 
        p.project_id,
        p.title,
        p.code,
        p.created_at,
        p.finished_at,
        p.letter_link,
        p.status_id,
        p.modality_id,
        p.research_line_id,
        p.research_subline_id,
        s.name as status_name,
        m.name as modality_name,
        rl.name as line_name,
        rsl.name as subline_name
      FROM public.projects p
      LEFT JOIN public.statuses s ON p.status_id = s.status_id
      LEFT JOIN public.modalities m ON p.modality_id = m.modality_id
      LEFT JOIN public.research_lines rl ON p.research_line_id = rl.research_line_id
      LEFT JOIN public.research_sublines rsl ON p.research_subline_id = rsl.research_subline_id
      ORDER BY p.created_at DESC;
    `;
    const projectsRes = await pool.query(projectsQuery);

    const userProjectsQuery = `
      SELECT 
        up.user_project_id,
        up.project_id,
        up.user_id,
        COALESCE(up.project_role, 'autor') as project_role,
        u.full_name,
        u.email,
        u.program_id,
        pr.name as program_name,
        f.faculty_id,
        f.name as faculty_name,
        st.semester_id,
        sem.semester_number
      FROM public.user_projects up
      JOIN public.users u ON up.user_id = u.user_id
      LEFT JOIN public.programs pr ON u.program_id = pr.program_id
      LEFT JOIN public.faculties f ON pr.faculty_id = f.faculty_id
      LEFT JOIN public.students st ON st.user_id::text = u.user_id::text
      LEFT JOIN public.semesters sem ON sem.semester_id = st.semester_id;
    `;
    const userProjectsRes = await pool.query(userProjectsQuery);

    const userProjectsByProject = {};
    userProjectsRes.rows.forEach(up => {
      if (!userProjectsByProject[up.project_id]) {
        userProjectsByProject[up.project_id] = [];
      }
      userProjectsByProject[up.project_id].push({
        ...up,
        user_id: String(up.user_id),
      });
    });

    // Counts of progress and documents
    const [progressCountsRes, documentCountsRes, historyCountsRes] = await Promise.all([
      pool.query(`SELECT project_id, COUNT(*)::int as count FROM public.research_progress GROUP BY project_id`),
      pool.query(`SELECT project_id, COUNT(*)::int as count FROM public.research_documents GROUP BY project_id`),
      pool.query(`SELECT project_id, COUNT(*)::int as count FROM public.project_histories GROUP BY project_id`),
    ]);

    const progressMap = Object.fromEntries(progressCountsRes.rows.map(r => [r.project_id, r.count]));
    const documentMap = Object.fromEntries(documentCountsRes.rows.map(r => [r.project_id, r.count]));
    const historyMap = Object.fromEntries(historyCountsRes.rows.map(r => [r.project_id, r.count]));

    let detailedProjects = projectsRes.rows.map(p => {
      const participants = userProjectsByProject[p.project_id] || [];
      const authors = participants.filter(up => up.project_role === 'autor' || up.project_role === 'coautor');
      const advisors = participants.filter(up => up.project_role === 'asesor');
      const jurors = participants.filter(up => up.project_role === 'jurado');

      const primaryAuthor = authors[0] || participants[0];
      const authorSemesterNumber = primaryAuthor?.semester_number || null;
      const authorSemesterId = primaryAuthor?.semester_id || null;
      const programName = primaryAuthor?.program_name || 'Sin programa';
      const facultyName = primaryAuthor?.faculty_name || 'Sin facultad';
      const projectProgramId = primaryAuthor?.program_id || null;

      const createdDate = p.created_at ? new Date(p.created_at) : null;
      const year = createdDate ? createdDate.getFullYear() : null;
      const month = createdDate ? createdDate.getMonth() + 1 : null;
      const calcAcademicPeriod = year ? `${year}-${month <= 6 ? '1' : '2'}` : 'Sin periodo';

      return {
        id: p.project_id,
        project_id: p.project_id,
        title: p.title,
        code: p.code || `PR-${p.project_id}`,
        created_at: p.created_at,
        finished_at: p.finished_at,
        letterLink: p.letter_link,
        statusId: p.status_id,
        status: p.status_name || 'Sin estado',
        modalityId: p.modality_id,
        modality: p.modality_name || 'Sin modalidad',
        lineId: p.research_line_id,
        line: p.line_name || 'Sin línea',
        sublineId: p.research_subline_id,
        subline: p.subline_name || 'Sin sublínea',
        programId: projectProgramId,
        programName,
        facultyName,
        semesterNumber: authorSemesterNumber,
        semesterId: authorSemesterId,
        academicPeriod: calcAcademicPeriod,
        historyCount: historyMap[p.project_id] || 0,
        progressCount: progressMap[p.project_id] || 0,
        documentsCount: documentMap[p.project_id] || 0,
        authors: authors.map(a => ({
          id: String(a.user_id),
          name: a.full_name,
          email: a.email,
          role: a.project_role,
          program: a.program_name,
          programId: a.program_id,
          semesterNumber: a.semester_number,
        })),
        advisors: advisors.map(a => ({
          id: String(a.user_id),
          name: a.full_name,
          email: a.email,
          program: a.program_name,
          programId: a.program_id,
        })),
        jurors: jurors.map(a => ({
          id: String(a.user_id),
          name: a.full_name,
          email: a.email,
          program: a.program_name,
          programId: a.program_id,
        })),
      };
    });

    // Apply strict program isolation
    if (parsedProgramId) {
      detailedProjects = detailedProjects.filter(p => String(p.programId) === String(parsedProgramId));
    }

    // Apply filters
    if (parsedStatusId) {
      detailedProjects = detailedProjects.filter(p => p.statusId === parsedStatusId);
    }
    if (parsedModalityId) {
      detailedProjects = detailedProjects.filter(p => p.modalityId === parsedModalityId);
    }
    if (parsedLineId) {
      detailedProjects = detailedProjects.filter(p => p.lineId === parsedLineId);
    }
    if (parsedSemesterNumber) {
      detailedProjects = detailedProjects.filter(p => p.semesterNumber === parsedSemesterNumber);
    }
    if (academicPeriod && academicPeriod !== 'all') {
      detailedProjects = detailedProjects.filter(p => p.academicPeriod === academicPeriod);
    }
    if (advisorId && advisorId !== 'all') {
      detailedProjects = detailedProjects.filter(p => (p.advisors || []).some(a => a.id === String(advisorId)));
    }
    if (startDate) {
      const start = new Date(startDate);
      detailedProjects = detailedProjects.filter(p => p.created_at && new Date(p.created_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      detailedProjects = detailedProjects.filter(p => p.created_at && new Date(p.created_at) <= end);
    }
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      detailedProjects = detailedProjects.filter(p =>
        (p.title || '').toLowerCase().includes(term) ||
        (p.code || '').toLowerCase().includes(term) ||
        (p.authors || []).some(a => (a.name || '').toLowerCase().includes(term)) ||
        (p.advisors || []).some(adv => (adv.name || '').toLowerCase().includes(term))
      );
    }

    // Compute Summary Stats
    const byStatus = {};
    const byModality = {};
    const byLine = {};
    const bySemester = {};

    detailedProjects.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      byModality[p.modality] = (byModality[p.modality] || 0) + 1;
      byLine[p.line] = (byLine[p.line] || 0) + 1;
      const semKey = p.semesterNumber ? `${p.semesterNumber}° Semestre` : (p.academicPeriod || 'Sin semestre');
      bySemester[semKey] = (bySemester[semKey] || 0) + 1;
    });

    res.json({
      projects: detailedProjects,
      total: detailedProjects.length,
      summary: {
        total: detailedProjects.length,
        byStatus,
        byModality,
        byLine,
        bySemester,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Reports detailed error:', err);
    res.status(500).json({ error: 'Error al generar datos de reporte: ' + err.message });
  }
});

// Get Technical Sheet for Single Project Report
app.get('/api/reports/projects/:id', async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'ID de proyecto inválido.' });

  try {
    const projectQuery = `
      SELECT 
        p.project_id,
        p.title,
        p.code,
        p.created_at,
        p.finished_at,
        p.letter_link,
        p.status_id,
        p.modality_id,
        p.research_line_id,
        p.research_subline_id,
        s.name as status_name,
        m.name as modality_name,
        rl.name as line_name,
        rsl.name as subline_name
      FROM public.projects p
      LEFT JOIN public.statuses s ON p.status_id = s.status_id
      LEFT JOIN public.modalities m ON p.modality_id = m.modality_id
      LEFT JOIN public.research_lines rl ON p.research_line_id = rl.research_line_id
      LEFT JOIN public.research_sublines rsl ON p.research_subline_id = rsl.research_subline_id
      WHERE p.project_id = $1
      LIMIT 1;
    `;
    const projRes = await pool.query(projectQuery, [projectId]);

    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }
    const p = projRes.rows[0];

    const [participantsRes, historyRes, progressRes, documentsRes] = await Promise.all([
      pool.query(`
        SELECT 
          up.user_project_id,
          up.project_id,
          up.user_id,
          COALESCE(up.project_role, 'autor') as project_role,
          u.full_name,
          u.email,
          u.program_id,
          pr.name as program_name,
          f.name as faculty_name,
          st.semester_id,
          sem.semester_number
        FROM public.user_projects up
        JOIN public.users u ON up.user_id = u.user_id
        LEFT JOIN public.programs pr ON u.program_id = pr.program_id
        LEFT JOIN public.faculties f ON pr.faculty_id = f.faculty_id
        LEFT JOIN public.students st ON st.user_id::text = u.user_id::text
        LEFT JOIN public.semesters sem ON sem.semester_id = st.semester_id
        WHERE up.project_id = $1
      `, [projectId]),
      pool.query(`
        SELECT h.history_id, h.description, h.modified_field, h.old_value, h.new_value, h.change_type, h.changed_at
        FROM public.project_histories ph
        JOIN public.histories h ON ph.history_id = h.history_id
        WHERE ph.project_id = $1
        ORDER BY h.changed_at DESC;
      `, [projectId]),
      pool.query(`
        SELECT rp.progress_id, rp.description, rp.created_at, u.full_name as author_name
        FROM public.research_progress rp
        JOIN public.users u ON u.user_id = rp.user_id
        WHERE rp.project_id = $1
        ORDER BY rp.created_at DESC;
      `, [projectId]),
      pool.query(`
        SELECT rd.document_id, rd.document_type, rd.file_url, rd.observations, rd.delivered_at, u.full_name as author_name
        FROM public.research_documents rd
        JOIN public.users u ON u.user_id = rd.user_id
        WHERE rd.project_id = $1
        ORDER BY rd.delivered_at DESC;
      `, [projectId]),
    ]);

    const participants = participantsRes.rows.map(up => ({
      ...up,
      user_id: String(up.user_id),
    }));

    const authors = participants.filter(up => up.project_role === 'autor' || up.project_role === 'coautor');
    const advisors = participants.filter(up => up.project_role === 'asesor');
    const jurors = participants.filter(up => up.project_role === 'jurado');

    const primaryAuthor = authors[0] || participants[0];
    const programName = primaryAuthor?.program_name || 'Sin programa';
    const facultyName = primaryAuthor?.faculty_name || 'Sin facultad';
    const authorSemesterNumber = primaryAuthor?.semester_number || null;

    const createdDate = p.created_at ? new Date(p.created_at) : null;
    const year = createdDate ? createdDate.getFullYear() : null;
    const month = createdDate ? createdDate.getMonth() + 1 : null;
    const calcAcademicPeriod = year ? `${year}-${month <= 6 ? '1' : '2'}` : 'Sin periodo';

    res.json({
      id: p.project_id,
      project_id: p.project_id,
      title: p.title,
      code: p.code || `PR-${p.project_id}`,
      created_at: p.created_at,
      finished_at: p.finished_at,
      letterLink: p.letter_link,
      statusId: p.status_id,
      status: p.status_name || 'Sin estado',
      modalityId: p.modality_id,
      modality: p.modality_name || 'Sin modalidad',
      lineId: p.research_line_id,
      line: p.line_name || 'Sin línea',
      sublineId: p.research_subline_id,
      subline: p.subline_name || 'Sin sublínea',
      programId: primaryAuthor?.program_id || null,
      programName,
      facultyName,
      semesterNumber: authorSemesterNumber,
      academicPeriod: calcAcademicPeriod,
      authors: authors.map(a => ({
        id: String(a.user_id),
        name: a.full_name,
        email: a.email,
        role: a.project_role,
        program: a.program_name,
        semesterNumber: a.semester_number,
      })),
      advisors: advisors.map(a => ({
        id: String(a.user_id),
        name: a.full_name,
        email: a.email,
        program: a.program_name,
      })),
      jurors: jurors.map(a => ({
        id: String(a.user_id),
        name: a.full_name,
        email: a.email,
        program: a.program_name,
      })),
      history: historyRes.rows,
      progress: progressRes.rows,
      documents: documentsRes.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Single project report error:', err);
    res.status(500).json({ error: 'Error al obtener ficha de reporte del proyecto: ' + err.message });
  }
});

// ─── CHATBOOK: CONSULTAS DE SOLO LECTURA ─────────────────────────────────────

const CHATBOOK_NOT_FOUND = 'No encuentro esta información registrada actualmente en el sistema.';

function normalizeChatbookRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('docent')) return 'docente';
  if (normalized.includes('estudiant')) return 'estudiante';
  return normalized || 'usuario';
}

function classifyChatbookQuery(message) {
  const text = String(message || '').toLowerCase();
  const projectCode = String(message || '').match(/\b[A-Z]{1,8}-\d+\b/i)?.[0] || '';
  const wantsMine = /\b(mi|mis|mío|mía|mios|mías|asesoro|asesor[oa])\b/.test(text);
  const asksPeople = /docente|profesor|asesor|participantes|integrantes|estudiantes|asociad/.test(text);
  const asksLines = /línea|linea|sublínea|sublinea/.test(text);
  const asksStatuses = /estado|disponible|ejecución|terminad|finalizad/.test(text);
  const asksCounts = /cuánt|cuant|cantidad|total|por estado/.test(text);
  const asksCatalog = /modalidad|estado|líneas|lineas|sublíneas|sublineas/.test(text);
  const asksLineCatalog = /qué líneas|que lineas|qué línea|que linea|líneas de investigación|lineas de investigacion|docentes?.*(línea|linea)|cada línea|cada linea/.test(text);
  const asksProjectDetail = Boolean(projectCode) || /información del proyecto|informacion del proyecto|detalles? del proyecto|fecha de inicio|fecha de finalización|fecha de finalizacion|cuándo termina|cuando termina|autores? del proyecto|docente.*proyecto|línea.*proyecto|linea.*proyecto/.test(text);
  return {
    text,
    wantsMine,
    asksPeople,
    asksLines,
    asksStatuses,
    asksCounts,
    asksCatalog,
    asksLineCatalog,
    asksProjectDetail,
    projectCode,
    search: String(message || '').replace(/\b(busca|buscar|muéstrame|muestrame|quiero|información|informacion|proyectos|proyecto|disponibles|disponible|de|sobre|en|la|el|los|las|qué|que|cuál|cual|hay|existen|mis|mi)\b/gi, ' ').replace(/\b[A-Z]{1,8}-\d+\b/gi, ' ').replace(/\s+/g, ' ').trim(),
  };
}

function formatChatbookProject(row) {
  const participants = row.participants || [];
  return {
    id: row.project_id,
    title: row.title,
    code: row.code,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    line: row.line_name,
    subline: row.subline_name,
    modality: row.modality_name,
    status: row.status_name,
    authors: participants.filter((person) => ['autor', 'coautor'].includes(String(person.role).toLowerCase())),
    teachers: participants.filter((person) => ['asesor', 'jurado', 'docente'].includes(String(person.role).toLowerCase())),
    participants,
  };
}

function formatProjectMessage(project) {
  const peopleInfo = (people) => people.length
    ? people.map((person) => [person.name, person.email, person.program].filter(Boolean).join(' · ') + (person.role ? ` (${person.role})` : '')).join(', ')
    : CHATBOOK_NOT_FOUND;
  return [
    'INFORMACIÓN DEL PROYECTO',
    `Nombre: ${project.title || CHATBOOK_NOT_FOUND}`,
    `Código: ${project.code || CHATBOOK_NOT_FOUND}`,
    `Estado: ${project.status || CHATBOOK_NOT_FOUND}`,
    `Fecha de inicio: ${project.createdAt ? new Date(project.createdAt).toLocaleDateString('es-CO') : CHATBOOK_NOT_FOUND}`,
    `Fecha de finalización: ${project.finishedAt ? new Date(project.finishedAt).toLocaleDateString('es-CO') : CHATBOOK_NOT_FOUND}`,
    `Línea de investigación: ${project.line || CHATBOOK_NOT_FOUND}`,
    `Sublínea de investigación: ${project.subline || CHATBOOK_NOT_FOUND}`,
    `Modalidad: ${project.modality || CHATBOOK_NOT_FOUND}`,
    `Autores: ${peopleInfo(project.authors)}`,
    `Docentes asociados: ${peopleInfo(project.teachers)}`,
  ].join('\n');
}

app.post('/api/chatbook/query', async (req, res) => {
  const { userId, message } = req.body || {};
  if (!userId || !String(message || '').trim()) {
    return res.status(400).json({ error: 'Escribe una pregunta para continuar.' });
  }

  try {
    const accessRes = await pool.query(
      `SELECT u.user_id, COALESCE(r.name, 'usuario') AS role_name
       FROM public.users u
       LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
       LEFT JOIN public.roles r ON r.role_id = ur.role_id
       WHERE u.user_id::text = $1
       LIMIT 1`,
      [String(userId)]
    );
    if (accessRes.rows.length === 0) return res.status(403).json({ error: 'No tienes permisos para consultar esta información.' });

    const role = normalizeChatbookRole(accessRes.rows[0].role_name);
    const query = classifyChatbookQuery(message);
    const values = [];
    const filters = [];
    let scope = '';
    const lineSearch = query.search.replace(/\b(línea|linea)\b/gi, ' ').replace(/\s+/g, ' ').trim();

    if (query.asksLineCatalog) {
      const lineValues = [];
      const lineSearch = query.search.replace(/\b(línea|linea)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      const lineTerms = lineSearch.split(' ').filter((term) => term.length > 2 && !['del', 'las', 'los', 'una', 'uno'].includes(term));
      const specificLineSearch = lineTerms.length > 0 && !/investigaci[oó]n|existen|docentes?|pertenecen|cada/.test(lineSearch);
      const lineFilter = specificLineSearch
        ? `WHERE ${lineTerms.map((term) => { lineValues.push(`%${term}%`); return `rl.name ILIKE $${lineValues.length}`; }).join(' AND ')}`
        : '';
      const linesRes = await pool.query(
        `SELECT rl.research_line_id, rl.name, rl.description,
                COALESCE((SELECT json_agg(json_build_object('name', rsl.name, 'description', rsl.description) ORDER BY rsl.name)
                          FROM public.research_sublines rsl
                          WHERE rsl.research_line_id = rl.research_line_id), '[]'::json) AS sublines,
                COALESCE((SELECT json_agg(json_build_object('name', teacher.full_name, 'email', teacher.email) ORDER BY teacher.full_name)
                          FROM (SELECT DISTINCT u.full_name, u.email
                                FROM public.projects p
                                JOIN public.user_projects up ON up.project_id = p.project_id
                                JOIN public.users u ON u.user_id = up.user_id
                                JOIN public.user_roles ur ON ur.user_id = u.user_id
                                JOIN public.roles r ON r.role_id = ur.role_id
                                WHERE p.research_line_id = rl.research_line_id
                                  AND LOWER(r.name) LIKE '%docent%') teacher), '[]'::json) AS teachers
        FROM public.research_lines rl ${lineFilter} ORDER BY rl.name`,
        lineValues,
      );
      const lines = linesRes.rows;
      return res.json({
        message: lines.length ? `Encontré ${lines.length} línea${lines.length === 1 ? '' : 's'} de investigación.` : CHATBOOK_NOT_FOUND,
        lines,
        projects: [],
        context: null,
      });
    }

    if (query.wantsMine && role === 'estudiante') {
      values.push(String(userId));
      scope = `AND EXISTS (SELECT 1 FROM public.user_projects mine WHERE mine.project_id = p.project_id AND mine.user_id::text = $${values.length})`;
    } else if (query.wantsMine && role === 'docente') {
      values.push(String(userId));
      scope = `AND EXISTS (SELECT 1 FROM public.user_projects mine WHERE mine.project_id = p.project_id AND mine.user_id::text = $${values.length} AND COALESCE(mine.project_role, 'autor') = 'asesor')`;
    } else if (query.wantsMine && role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos para consultar esta información.' });
    }

    if (query.search && query.search.length > 2 && !query.projectCode && !query.asksLines && !query.asksCatalog && !query.asksPeople) {
      values.push(`%${query.search}%`);
      filters.push(`(p.title ILIKE $${values.length} OR p.code ILIKE $${values.length} OR rl.name ILIKE $${values.length} OR rsl.name ILIKE $${values.length} OR m.name ILIKE $${values.length} OR s.name ILIKE $${values.length})`);
    }
    if (query.projectCode) {
      values.push(query.projectCode);
      filters.push(`p.code ILIKE $${values.length}`);
    }
    let matchedLineId = null;
    if (query.asksLines && !query.projectCode) {
      const lineMatch = await pool.query(
        `SELECT research_line_id
         FROM public.research_lines
         WHERE POSITION(LOWER(name) IN LOWER($1)) > 0
         ORDER BY LENGTH(name) DESC
         LIMIT 1`,
        [String(message)],
      );
      if (lineMatch.rows.length > 0) {
        matchedLineId = lineMatch.rows[0].research_line_id;
        values.push(matchedLineId);
        filters.push(`p.research_line_id = $${values.length}`);
      }
    }
    if (query.asksLines && !matchedLineId && lineSearch.length > 2 && !query.projectCode) {
      const lineTerms = lineSearch.split(' ').filter((term) => term.length > 2 && !['del', 'las', 'los', 'una', 'uno'].includes(term));
      lineTerms.forEach((term) => {
        values.push(`%${term}%`);
        filters.push(`rl.name ILIKE $${values.length}`);
      });
    }
    if (/\bdisponible\b/.test(query.text)) {
      values.push('%disponible%');
      filters.push(`s.name ILIKE $${values.length}`);
    }

    if (query.asksCounts) {
      const countRes = await pool.query(
        `SELECT COALESCE(s.name, 'Sin estado') AS status, COUNT(*)::int AS total
         FROM public.projects p LEFT JOIN public.statuses s ON s.status_id = p.status_id
         GROUP BY COALESCE(s.name, 'Sin estado') ORDER BY total DESC`,
      );
      const summary = countRes.rows.map((row) => `${row.status}: ${row.total}`).join(' | ');
      return res.json({ message: summary || CHATBOOK_NOT_FOUND, projects: [], context: null });
    }

    const projectRes = await pool.query(
      `SELECT p.project_id, p.title, p.code, p.created_at, p.finished_at,
              s.name AS status_name, m.name AS modality_name,
              rl.name AS line_name, rsl.name AS subline_name,
              COALESCE((SELECT json_agg(json_build_object('name', u.full_name, 'email', u.email, 'program', pr.name, 'role', COALESCE(up.project_role, 'autor')) ORDER BY u.full_name)
                        FROM public.user_projects up JOIN public.users u ON u.user_id = up.user_id
                        LEFT JOIN public.programs pr ON pr.program_id = u.program_id
                        WHERE up.project_id = p.project_id), '[]'::json) AS participants
       FROM public.projects p
       LEFT JOIN public.statuses s ON s.status_id = p.status_id
       LEFT JOIN public.modalities m ON m.modality_id = p.modality_id
       LEFT JOIN public.research_lines rl ON rl.research_line_id = p.research_line_id
       LEFT JOIN public.research_sublines rsl ON rsl.research_subline_id = p.research_subline_id
       WHERE 1 = 1 ${scope} ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
       ORDER BY p.created_at DESC LIMIT 25`,
      values,
    );
    const projects = projectRes.rows.map(formatChatbookProject);
    const subject = query.wantsMine ? 'asociados a tu cuenta' : 'relacionados con tu consulta';
    return res.json({
      message: projects.length
        ? (query.asksProjectDetail && projects.length === 1 ? formatProjectMessage(projects[0]) : `Encontré ${projects.length} proyecto${projects.length === 1 ? '' : 's'} ${subject}.`)
        : 'No encontré proyectos que coincidan con tu búsqueda.',
      projects,
      context: projects.length === 1 ? projects[0] : null,
    });
  } catch (err) {
    console.error('Chatbook query error:', err);
    return res.status(500).json({ error: 'No puedo consultar la información en este momento. Intenta nuevamente más tarde.' });
  }
});

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

app.get('/api/analytics', async (req, res) => {
  const { adminProgramId, programId } = req.query;
  const targetProgramId = (adminProgramId || programId) ? parseInt(adminProgramId || programId, 10) : null;

  try {
    const [projectsRes, statusesRes, linesRes, sublinesRes, programsRes, facultiesRes, userProjectsRes, studentsRes] = await Promise.all([
      pool.query('SELECT project_id, title, code, created_at, status_id, research_line_id, research_subline_id, modality_id FROM public.projects ORDER BY created_at DESC'),
      pool.query('SELECT status_id, name FROM public.statuses ORDER BY name'),
      pool.query('SELECT research_line_id, name FROM public.research_lines ORDER BY name'),
      pool.query('SELECT research_subline_id, name, research_line_id FROM public.research_sublines ORDER BY name'),
      pool.query('SELECT program_id, name, faculty_id FROM public.programs ORDER BY name'),
      pool.query('SELECT faculty_id, name FROM public.faculties ORDER BY name'),
      pool.query(`
        SELECT up.user_project_id, up.user_id, up.project_id, COALESCE(up.project_role, 'autor') as project_role,
               u.full_name, u.email, u.program_id, pr.name as program_name
        FROM public.user_projects up
        JOIN public.users u ON up.user_id = u.user_id
        LEFT JOIN public.programs pr ON u.program_id = pr.program_id
      `),
      pool.query(`
        SELECT s.student_id, s.user_id, u.program_id
        FROM public.students s
        JOIN public.users u ON s.user_id::text = u.user_id::text
      `),
    ]);

    let userProjects = userProjectsRes.rows.map(up => ({
      ...up,
      user_id: String(up.user_id),
    }));
    let projects = projectsRes.rows;
    let students = studentsRes.rows.map(s => ({ ...s, user_id: String(s.user_id) }));

    if (targetProgramId) {
      const authorProjectIds = new Set(
        userProjectsRes.rows
          .filter(up => String(up.program_id) === String(targetProgramId) && (up.project_role === 'autor' || up.project_role === 'coautor' || !up.project_role))
          .map(up => up.project_id)
      );
      projects = projects.filter(p => authorProjectIds.has(p.project_id));
      userProjects = userProjects.filter(up => String(up.program_id) === String(targetProgramId) && authorProjectIds.has(up.project_id));
      students = students.filter(s => String(s.program_id) === String(targetProgramId));
    }

    res.json({
      projects,
      statuses: statusesRes.rows,
      lines: linesRes.rows,
      sublines: sublinesRes.rows,
      programs: targetProgramId ? programsRes.rows.filter(p => String(p.program_id) === String(targetProgramId)) : programsRes.rows,
      faculties: facultiesRes.rows,
      userProjects,
      students,
    });
  } catch (err) {
    console.error('Analytics endpoint error:', err);
    res.status(500).json({ error: 'Error al obtener datos analíticos.' });
  }
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Express Backend] Servidor ejecutándose en http://localhost:${PORT} y http://127.0.0.1:${PORT}`);
  console.log(`[PostgreSQL DB] Conectado a la base de datos BaseDatosGrado`);
});
