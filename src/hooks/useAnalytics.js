import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase/client';
import { hasSupabaseConfig } from '../lib/supabase/config';

export function useAnalytics(adminProgramId = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!hasSupabaseConfig) {
      setLoading(false);
      setData({ projects: [], totalProjects: 0, statuses: [], lines: [], sublines: [], programs: [], faculties: [], numStudents: 0, numLines: 0, projectsByStatus: {}, projectsByLine: {}, projectsBySubline: {}, projectsByProgram: {}, projectsByYearSemester: [], topLine: null, topProgram: null, topStatus: null, topAdvisor: [], topSublines: [], lineSublineMatrix: {}, recentProjects: [] });
      return;
    }

    setLoading(true);
    setError('');

    try {
      let supabase;
      try {
        supabase = getSupabaseClient();
      } catch (clientErr) {
        setError('Supabase no configurado correctamente.');
        setLoading(false);
        return;
      }

      const [
        projectsRes,
        statusesRes,
        linesRes,
        sublinesRes,
        programsRes,
        facultiesRes,
        userProjectsRes,
        studentsRes,
      ] = await Promise.all([
        supabase
          .from('projects')
          .select('project_id, title, code, created_at, status_id, research_line_id, research_subline_id, modality_id, user_projects(user_id, project_role, users(full_name, email, program_id, programs(name)))')
          .order('created_at', { ascending: false }),
        supabase.from('statuses').select('status_id, name').order('name'),
        supabase.from('research_lines').select('research_line_id, name').order('name'),
        supabase.from('research_sublines').select('research_subline_id, name, research_line_id').order('name'),
        supabase.from('programs').select('program_id, name, faculty_id').order('name'),
        supabase.from('faculties').select('faculty_id, name').order('name'),
        supabase.from('user_projects').select('user_project_id, user_id, project_id, project_role, users(full_name, email, program_id, programs(name))'),
        supabase.from('students').select('student_id, user_id'),
      ]);

      if (projectsRes.error) {
        setError('Error cargando proyectos.');
        setLoading(false);
        return;
      }

      let projects = projectsRes.data || [];
      const statuses = statusesRes.data || [];
      const lines = linesRes.data || [];
      const sublines = sublinesRes.data || [];
      const programs = programsRes.data || [];
      const faculties = facultiesRes.data || [];
      const userProjects = userProjectsRes.data || [];
      const students = studentsRes.data || [];

      if (adminProgramId !== null) {
        const programUserIds = new Set(
          userProjects
            .filter(up => String(up.users?.program_id) === String(adminProgramId))
            .map(up => up.user_id)
        );
        projects = projects.filter(p =>
          (p.user_projects || []).some(up => programUserIds.has(up.user_id))
        );
      }

      const statusMap = {};
      statuses.forEach(s => { statusMap[s.status_id] = s.name; });

      const lineMap = {};
      lines.forEach(l => { lineMap[l.research_line_id] = l.name; });

      const sublineMap = {};
      sublines.forEach(sl => { sublineMap[sl.research_subline_id] = sl.name; });

      const programMap = {};
      programs.forEach(p => { programMap[p.program_id] = p.name; });

      const facultyMap = {};
      faculties.forEach(f => { facultyMap[f.faculty_id] = f.name; });

      const enrichedProjects = projects.map(p => {
        const authors = (p.user_projects || []).filter(up =>
          up.project_role === 'autor' || up.project_role === 'coautor' || !up.project_role
        );
        const advisors = (p.user_projects || []).filter(up => up.project_role === 'asesor');
        const programId = authors[0]?.users?.program_id || null;
        const facultyId = programs.find(pr => pr.program_id === programId)?.faculty_id || null;

        return {
          id: p.project_id,
          title: p.title,
          code: p.code,
          statusId: p.status_id,
          statusName: statusMap[p.status_id] || 'Sin estado',
          lineId: p.research_line_id,
          lineName: lineMap[p.research_line_id] || 'Sin línea',
          sublineId: p.research_subline_id,
          sublineName: sublineMap[p.research_subline_id] || 'Sin sublínea',
          modalityId: p.modality_id,
          programId,
          programName: programMap[programId] || null,
          facultyId,
          facultyName: facultyMap[facultyId] || null,
          createdAt: p.created_at,
          year: p.created_at ? new Date(p.created_at).getFullYear() : null,
          semester: p.created_at ? getSemester(p.created_at) : null,
          authors: authors.map(a => a.users?.full_name).filter(Boolean),
          advisors: advisors.map(a => a.users?.full_name).filter(Boolean),
        };
      });

      const projectsByStatus = {};
      statuses.forEach(s => { projectsByStatus[s.name] = 0; });
      enrichedProjects.forEach(p => {
        projectsByStatus[p.statusName] = (projectsByStatus[p.statusName] || 0) + 1;
      });

      const projectsByLine = {};
      enrichedProjects.forEach(p => {
        projectsByLine[p.lineName] = (projectsByLine[p.lineName] || 0) + 1;
      });

      const projectsBySubline = {};
      enrichedProjects.forEach(p => {
        if (p.sublineName && p.sublineName !== 'Sin sublínea') {
          projectsBySubline[p.sublineName] = (projectsBySubline[p.sublineName] || 0) + 1;
        }
      });

      const projectsByProgram = {};
      enrichedProjects.forEach(p => {
        const key = p.programName || 'Sin programa';
        projectsByProgram[key] = (projectsByProgram[key] || 0) + 1;
      });

      const projectsByYearSemester = {};
      enrichedProjects.forEach(p => {
        if (p.year && p.semester) {
          const key = `${p.year}-${p.semester}`;
          projectsByYearSemester[key] = (projectsByYearSemester[key] || 0) + 1;
        }
      });

      const advisorProjectCount = {};
      userProjects.forEach(up => {
        if (up.project_role === 'asesor' && up.users?.full_name) {
          const name = up.users.full_name;
          let belongsToProgram = true;
          if (adminProgramId !== null) {
            belongsToProgram = String(up.users?.program_id) === String(adminProgramId);
          }
          if (belongsToProgram) {
            advisorProjectCount[name] = (advisorProjectCount[name] || 0) + 1;
          }
        }
      });

      const lineSublineMatrix = {};
      lines.forEach(l => { lineSublineMatrix[l.name] = {}; });
      enrichedProjects.forEach(p => {
        if (p.lineName && p.sublineName && p.sublineName !== 'Sin sublínea') {
          if (!lineSublineMatrix[p.lineName]) lineSublineMatrix[p.lineName] = {};
          lineSublineMatrix[p.lineName][p.sublineName] = (lineSublineMatrix[p.lineName][p.sublineName] || 0) + 1;
        }
      });

      const uniqueStudentIds = new Set(students.map(s => s.user_id));
      const numStudents = uniqueStudentIds.size;

      const topLine = Object.entries(projectsByLine).sort((a, b) => b[1] - a[1])[0] || null;
      const topProgram = Object.entries(projectsByProgram).sort((a, b) => b[1] - a[1])[0] || null;
      const topStatus = Object.entries(projectsByStatus).sort((a, b) => b[1] - a[1])[0] || null;

      const sortedTimeEntries = Object.entries(projectsByYearSemester)
        .sort((a, b) => a[0].localeCompare(b[0]));

      const topAdvisor = Object.entries(advisorProjectCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const topSublines = Object.entries(projectsBySubline)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      setData({
        projects: enrichedProjects,
        totalProjects: enrichedProjects.length,
        statuses,
        lines,
        sublines,
        programs,
        faculties,
        numStudents,
        numLines: lines.length,

        projectsByStatus,
        projectsByLine,
        projectsBySubline,
        projectsByProgram,
        projectsByYearSemester: sortedTimeEntries,

        topLine,
        topProgram,
        topStatus,
        topAdvisor,
        topSublines,
        lineSublineMatrix,

        recentProjects: enrichedProjects.slice(0, 5),
      });
    } catch (err) {
      setError('Error cargando datos analíticos.');
    } finally {
      setLoading(false);
    }
  }, [adminProgramId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { ...data, loading, error, refetch: fetchData };
}

function getSemester(dateStr) {
  const month = new Date(dateStr).getMonth() + 1;
  return month <= 6 ? 'S1' : 'S2';
}
