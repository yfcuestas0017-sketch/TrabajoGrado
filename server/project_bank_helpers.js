/**
 * Funciones auxiliares para el Banco de Proyectos:
 * - Consulta de contexto de usuario (rol y programa real en BD).
 * - Registro estructurado de historial y auditoría en public.project_bank_histories.
 * - Cálculo de diferencias (diff) estructuradas en formato JSONB.
 */

export async function getUserContext(client, userId) {
  if (!userId) return null;
  const query = `
    SELECT u.user_id, u.full_name, u.email, u.program_id,
           COALESCE(LOWER(r.name), 'estudiante') as role_name,
           pr.name as program_name
    FROM public.users u
    LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN public.roles r ON ur.role_id = r.role_id
    LEFT JOIN public.programs pr ON u.program_id = pr.program_id
    WHERE u.user_id::text = $1
    LIMIT 1;
  `;
  const res = await client.query(query, [String(userId)]);
  return res.rows[0] || null;
}

export async function recordProjectBankHistory(client, {
  projectBankId,
  userId,
  action,
  previousStatus,
  newStatus,
  changes,
}) {
  const query = `
    INSERT INTO public.project_bank_histories (
      project_bank_id, user_id, action, previous_status, new_status, changes, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const res = await client.query(query, [
    parseInt(projectBankId, 10),
    String(userId),
    action,
    previousStatus || null,
    newStatus || null,
    changes ? JSON.stringify(changes) : null,
  ]);
  return res.rows[0];
}

export function computeProjectBankDiff(oldProject, updatedFields) {
  const diff = {};
  const fieldMappings = [
    { dbField: 'title', inputField: 'title', name: 'Título' },
    { dbField: 'description', inputField: 'description', name: 'Descripción' },
    { dbField: 'general_objective', inputField: 'generalObjective', name: 'Objetivo General' },
    { dbField: 'specific_objectives', inputField: 'specificObjectives', name: 'Objetivos Específicos' },
    { dbField: 'research_line_id', inputField: 'researchLineId', name: 'Línea de Investigación' },
    { dbField: 'research_subline_id', inputField: 'researchSublineId', name: 'Sublínea de Investigación' },
    { dbField: 'program_id', inputField: 'programId', name: 'Programa Académico' },
    { dbField: 'keywords', inputField: 'keywords', name: 'Palabras Clave' },
    { dbField: 'observations', inputField: 'observations', name: 'Observaciones' },
  ];

  for (const f of fieldMappings) {
    const oldVal = oldProject[f.dbField];
    const newVal = updatedFields[f.inputField] !== undefined 
      ? updatedFields[f.inputField] 
      : updatedFields[f.dbField];

    if (newVal !== undefined && newVal !== null) {
      const normalizedOld = String(oldVal ?? '').trim();
      const normalizedNew = String(newVal ?? '').trim();
      if (normalizedOld !== normalizedNew) {
        diff[f.dbField] = {
          label: f.name,
          before: oldVal !== null && oldVal !== undefined ? oldVal : null,
          after: newVal,
        };
      }
    }
  }

  return Object.keys(diff).length > 0 ? diff : { info: 'Actualización sin modificación de campos clave' };
}
