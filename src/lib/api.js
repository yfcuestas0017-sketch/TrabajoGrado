/**
 * Módulo cliente de la API REST para el frontend React.
 * Reemplaza a Supabase realizando peticiones al servidor Express (BaseDatosGrado PostgreSQL).
 */

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Error en la petición al servidor.');
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  register: (fields) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(fields),
  }),

  // Catalogs
  getCatalogs: () => request('/catalogs'),

  // Users
  checkCoauthor: (email) => request(`/users/check-coauthor?email=${encodeURIComponent(email)}`),

  // Projects
  getProjects: () => request('/projects'),

  createProject: (projectData) => request('/projects', {
    method: 'POST',
    body: JSON.stringify(projectData),
  }),

  updateProject: (id, projectData) => request(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(projectData),
  }),

  deleteProject: (id) => request(`/projects/${id}`, {
    method: 'DELETE',
  }),

  getProjectHistory: (id) => request(`/projects/${id}/history`),

  // Analytics
  getAnalytics: (adminProgramId = null) => request(`/analytics${adminProgramId ? `?adminProgramId=${adminProgramId}` : ''}`),
};

export default api;
