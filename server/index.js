import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import pool from './db.js';

dotenv.config({ path: '.env.local' });

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
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1;
    `;
    const result = await pool.query(query, [email.trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const user = result.rows[0];
    const storedPassword = user.password || '';
    const inputPassword = password.trim();

    if (storedPassword !== inputPassword) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
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
        roleId: user.role_id,
        permissions,
        programId: user.program_id,
        programName: user.program_name || null,
        authMode: 'postgres',
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor en inicio de sesión.' });
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

    // 4. Registrar info de estudiante si aplica
    if (semesterId && curriculumId) {
      await client.query(
        `INSERT INTO public.students (user_id, semester_id, curriculum_id)
         VALUES ($1, $2, $3)`,
        [String(newUser.user_id), parseInt(semesterId, 10), parseInt(curriculumId, 10)]
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

// ─── PROJECTS ────────────────────────────────────────────────────────────────

// Get All Projects
app.get('/api/projects', async (req, res) => {
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
        pr.name as program_name
      FROM public.user_projects up
      JOIN public.users u ON up.user_id = u.user_id
      LEFT JOIN public.programs pr ON u.program_id = pr.program_id;
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
    const enrichedProjects = projectsRes.rows.map(p => {
      const participants = userProjectsByProject[p.project_id] || [];
      const authors = participants.filter(up => up.project_role === 'autor' || up.project_role === 'coautor');
      const advisors = participants.filter(up => up.project_role === 'asesor');
      const jurors = participants.filter(up => up.project_role === 'jurado');

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
        user_projects: participants,
        authors: authors.map(a => ({ id: String(a.user_id), name: a.full_name, email: a.email, role: a.project_role, program: a.program_name })),
        advisors: advisors.map(a => ({ id: String(a.user_id), name: a.full_name, email: a.email, program: a.program_name })),
        jurors: jurors.map(a => ({ id: String(a.user_id), name: a.full_name, email: a.email, program: a.program_name })),
      };
    });

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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
  const { title, code, statusId, modalityId, lineId, sublineId, letterLink, coauthors } = req.body;

  if (isNaN(projectId)) return res.status(400).json({ error: 'ID de proyecto inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentRes = await client.query(
      'SELECT project_id, title, status_id FROM public.projects WHERE project_id = $1',
      [projectId]
    );
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
      code ? code.trim() : null,
      statusId ? parseInt(statusId, 10) : null,
      modalityId ? parseInt(modalityId, 10) : null,
      lineId ? parseInt(lineId, 10) : null,
      sublineId ? parseInt(sublineId, 10) : null,
      letterLink ? letterLink.trim() : null,
      projectId,
    ]);

    // Triggers en DB manejan `status_id` y `title` audit, pero podemos reforzar si es necesario:
    if (statusId && parseInt(statusId, 10) !== oldProj.status_id) {
      const histRes = await client.query(
        `INSERT INTO public.histories (description, modified_field, old_value, new_value, change_type)
         VALUES ('Status update', 'status_id', $1, $2, 'UPDATE') RETURNING history_id`,
        [String(oldProj.status_id), String(statusId)]
      );
      await client.query(
        'INSERT INTO public.project_histories (project_id, history_id) VALUES ($1, $2)',
        [projectId, histRes.rows[0].history_id]
      );
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

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

app.get('/api/analytics', async (req, res) => {
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
      pool.query('SELECT student_id, user_id FROM public.students'),
    ]);

    const formattedUserProjects = userProjectsRes.rows.map(up => ({
      ...up,
      user_id: String(up.user_id),
    }));

    res.json({
      projects: projectsRes.rows,
      statuses: statusesRes.rows,
      lines: linesRes.rows,
      sublines: sublinesRes.rows,
      programs: programsRes.rows,
      faculties: facultiesRes.rows,
      userProjects: formattedUserProjects,
      students: studentsRes.rows.map(s => ({ ...s, user_id: String(s.user_id) })),
    });
  } catch (err) {
    console.error('Analytics endpoint error:', err);
    res.status(500).json({ error: 'Error al obtener datos analíticos.' });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[Express Backend] Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`[PostgreSQL DB] Conectado a la base de datos BaseDatosGrado`);
});
