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
  getCatalogs: (programId = null) => request(`/catalogs${programId ? `?program_id=${encodeURIComponent(programId)}` : ''}`),
  getDegreeOptions: () => request('/degree-options'),

  // Users
  checkCoauthor: (email) => request(`/users/check-coauthor?email=${encodeURIComponent(email)}`),
  getStudentResearchProcess: (userId) => request(`/students/${encodeURIComponent(userId)}/research-process`),
  updateStudentAcademicProfile: (userId, semesterId) => request(`/students/${encodeURIComponent(userId)}/academic-profile`, {
    method: 'PUT',
    body: JSON.stringify({ semesterId }),
  }),
  getAcademicSettings: (userId) => request(`/admin/academic-settings?userId=${encodeURIComponent(userId)}`),
  updateSemesterDates: (userId, semesterId, startDate, endDate) => request(`/admin/semesters/${semesterId}/dates`, {
    method: 'PUT',
    body: JSON.stringify({ userId, startDate, endDate }),
  }),
  applyAcademicPromotion: (userId, referenceDate) => request('/admin/academic-promotion', {
    method: 'POST',
    body: JSON.stringify({ userId, referenceDate }),
  }),
  getResearchProgress: (projectId, userId) => request(`/projects/${projectId}/research-progress?userId=${encodeURIComponent(userId)}`),
  createResearchProgress: (projectId, userId, description) => request(`/projects/${projectId}/research-progress`, {
    method: 'POST',
    body: JSON.stringify({ userId, description }),
  }),
  getResearchDocuments: (projectId, userId) => request(`/projects/${projectId}/research-documents?userId=${encodeURIComponent(userId)}`),
  createResearchDocument: (projectId, payload) => request(`/projects/${projectId}/research-documents`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Projects
  getProjects: (programId = null) => request(`/projects${programId ? `?programId=${encodeURIComponent(programId)}` : ''}`),

  createProject: (projectData) => request('/projects', {
    method: 'POST',
    body: JSON.stringify(projectData),
  }),

  updateProject: (id, projectData, userId = null) => request(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...projectData, userId: userId || projectData.userId }),
  }),

  updateProjectParticipants: (id, participants, userId = null) => request(`/projects/${id}/participants`, {
    method: 'PUT',
    body: JSON.stringify({ participants, userId }),
  }),
  deleteProject: (id) => request(`/projects/${id}`, {
    method: 'DELETE',
  }),

  getProjectHistory: (id) => request(`/projects/${id}/history`),

  // Reports
  getDetailedReportProjects: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '' && val !== 'all') {
        params.append(key, val);
      }
    });
    const queryString = params.toString();
    return request(`/reports/detailed${queryString ? `?${queryString}` : ''}`);
  },

  getProjectReportDetail: (id) => request(`/reports/projects/${id}`),

  queryChatbook: (userId, message) => request('/chatbook/query', {
    method: 'POST',
    body: JSON.stringify({ userId, message }),
  }),

  // Analytics
  getAnalytics: (adminProgramId = null) => request(`/analytics${adminProgramId ? `?adminProgramId=${adminProgramId}` : ''}`),
};

export default api;
