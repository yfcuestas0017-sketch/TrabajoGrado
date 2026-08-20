import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Institutional Colors (CESMAG)
const PRIMARY_COLOR = [31, 91, 163];
const SECONDARY_COLOR = [186, 24, 40];
const DARK_TEXT = [24, 34, 56];
const MUTED_TEXT = [121, 135, 165];
const LIGHT_BG = [242, 245, 249];

function getY(doc) {
  return (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : 0;
}

function drawHeader(doc, title, subtitle, adminUser, programName) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, 18, 'F');

  doc.setFillColor(...SECONDARY_COLOR);
  doc.rect(0, 18, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('UNIVERSIDAD CESMAG', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Sistema de Gestión de Proyectos de Grado', pageWidth - 14, 11, { align: 'right' });

  doc.setTextColor(...DARK_TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, 14, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_TEXT);

  const metaLeft = [];
  if (subtitle) metaLeft.push(subtitle);
  if (programName) metaLeft.push(`Programa: ${programName}`);
  if (metaLeft.length > 0) doc.text(metaLeft.join('  |  '), 14, 34);

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const generatedBy = adminUser?.name ? `Generado por: ${adminUser.name}` : 'Generado por: Administrador';
  doc.text(`Fecha de emisión: ${dateStr} ${timeStr}  |  ${generatedBy}`, 14, 39);

  doc.setDrawColor(220, 227, 238);
  doc.setLineWidth(0.5);
  doc.line(14, 42, pageWidth - 14, 42);
}

function drawFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 227, 238);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_TEXT);
    doc.text('Universidad CESMAG — Documento oficial de consulta académica', 14, pageHeight - 9);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 9, { align: 'right' });
  }
}

/**
 * Reporte de un Proyecto Específico — PDF
 */
export function generateProjectPdf(project, adminUser = {}) {
  if (!project) throw new Error('No hay información del proyecto para generar el reporte.');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const programName = project.programName || null;

  drawHeader(doc, `REPORTE DE PROYECTO: ${project.code || `PR-${project.id}`}`, 'Ficha técnica integral y trazabilidad académica', adminUser, programName);

  // 1. Información General
  autoTable(doc, {
    startY: 46,
    head: [['1. INFORMACIÓN GENERAL Y ACADÉMICA', '']],
    body: [
      ['Título del Proyecto:', project.title || 'Sin título registrado'],
      ['Código del Proyecto:', project.code || `PR-${project.id}`],
      ['Estado Actual:', project.status || 'Sin estado'],
      ['Modalidad de Grado:', project.modality || 'Sin modalidad'],
      ['Línea de Investigación:', project.line || 'Sin línea'],
      ['Sublínea de Investigación:', project.subline || 'Sin sublínea'],
      ['Programa Académico:', project.programName || 'No especificado'],
      ['Facultad:', project.facultyName || 'No especificada'],
      ['Semestre / Periodo:', project.semesterNumber ? `${project.semesterNumber}° Semestre (${project.academicPeriod || ''})` : (project.academicPeriod || 'Sin definir')],
      ['Fecha de Registro:', project.created_at ? new Date(project.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Sin fecha'],
      ['Fecha de Finalización:', project.finished_at ? new Date(project.finished_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : 'En desarrollo'],
      ['Carta de Aprobación:', project.letterLink || 'Sin enlace registrado'],
    ],
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5, halign: 'left' },
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: DARK_TEXT, lineColor: [220, 227, 238] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, fillColor: LIGHT_BG },
      1: { cellWidth: pageWidth - 28 - 55 },
    },
  });

  // 2. Equipo de Trabajo
  const authorsList = (project.authors || []).map(a => `${a.name || 'Sin nombre'} (${a.email || '-'})`).join('\n') || 'Ninguno registrado';
  const advisorsList = (project.advisors || []).map(a => `${a.name || 'Sin nombre'} (${a.email || '-'})`).join('\n') || 'Sin asesor asignado';
  const jurorsList = (project.jurors || []).map(j => `${j.name || 'Sin nombre'} (${j.email || '-'})`).join('\n') || 'Sin jurados asignados';

  autoTable(doc, {
    startY: getY(doc) + 6,
    head: [['2. EQUIPO VINCULADO AL PROYECTO', '']],
    body: [
      ['Estudiantes / Autores:', authorsList],
      ['Docente Asesor:', advisorsList],
      ['Jurados Evaluadores:', jurorsList],
    ],
    theme: 'grid',
    headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5 },
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: DARK_TEXT, lineColor: [220, 227, 238] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, fillColor: LIGHT_BG },
      1: { cellWidth: pageWidth - 28 - 55 },
    },
  });

  // 3. Historial de Cambios
  const historyRows = (project.history || []).map(h => [
    h.changed_at ? new Date(h.changed_at).toLocaleDateString('es-CO') : '-',
    h.change_type || 'MODIFICACIÓN',
    h.description || (h.modified_field ? `${h.modified_field}: ${h.old_value || '-'} → ${h.new_value || '-'}` : 'Actualización'),
  ]);
  if (historyRows.length === 0) {
    historyRows.push(['-', 'CREACIÓN', 'Proyecto registrado sin modificaciones posteriores.']);
  }

  autoTable(doc, {
    startY: getY(doc) + 6,
    head: [['Fecha', 'Tipo de Acción', 'Descripción del Cambio']],
    body: historyRows,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 2, textColor: DARK_TEXT, lineColor: [220, 227, 238] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 32 },
      2: { cellWidth: pageWidth - 28 - 60 },
    },
    didDrawPage: (data) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...PRIMARY_COLOR);
      doc.text('3. HISTORIAL Y TRAZABILIDAD DE CAMBIOS', 14, data.settings.startY - 3);
    },
  });

  // 4. Avances (opcional)
  const progressRows = (project.progress || []).map(p => [
    p.created_at ? new Date(p.created_at).toLocaleDateString('es-CO') : '-',
    p.author_name || 'Estudiante',
    p.description || 'Sin detalle',
  ]);

  if (progressRows.length > 0) {
    autoTable(doc, {
      startY: getY(doc) + 6,
      head: [['Fecha', 'Registrado Por', 'Descripción del Avance']],
      body: progressRows,
      theme: 'grid',
      headStyles: { fillColor: SECONDARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 2, textColor: DARK_TEXT, lineColor: [220, 227, 238] },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 45 }, 2: { cellWidth: pageWidth - 28 - 73 } },
      didDrawPage: (data) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...SECONDARY_COLOR);
        doc.text('4. AVANCES DE INVESTIGACIÓN', 14, data.settings.startY - 3);
      },
    });
  }

  // 5. Documentos (opcional)
  const documentRows = (project.documents || []).map(d => [
    d.delivered_at ? new Date(d.delivered_at).toLocaleDateString('es-CO') : '-',
    d.document_type || 'Documento',
    d.author_name || 'Estudiante',
    d.file_url || 'Sin enlace',
  ]);

  if (documentRows.length > 0) {
    autoTable(doc, {
      startY: getY(doc) + 6,
      head: [['Fecha', 'Tipo de Documento', 'Entregado Por', 'Enlace / Referencia']],
      body: documentRows,
      theme: 'grid',
      headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 2, textColor: DARK_TEXT, lineColor: [220, 227, 238] },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 40 }, 2: { cellWidth: 45 }, 3: { cellWidth: pageWidth - 28 - 113 } },
      didDrawPage: (data) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...PRIMARY_COLOR);
        doc.text('5. DOCUMENTOS Y ENTREGABLES', 14, data.settings.startY - 3);
      },
    });
  }

  drawFooter(doc);

  const cleanCode = (project.code || `PROY_${project.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  doc.save(`Reporte_Proyecto_${cleanCode}_${dateSuffix}.pdf`);
}

/**
 * Reporte Consolidado de Todos los Proyectos — PDF
 */
export function generateConsolidatedPdf(projects = [], activeFilters = {}, adminUser = {}) {
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error('No hay proyectos para incluir en el reporte consolidado.');
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const programName = activeFilters.programName || adminUser?.programName || null;

  drawHeader(
    doc,
    'REPORTE CONSOLIDADO DE PROYECTOS DE GRADO',
    `Total: ${projects.length} proyecto${projects.length !== 1 ? 's' : ''}`,
    adminUser,
    programName
  );

  let startY = 46;

  // Filtros aplicados (si los hay)
  const filterPills = [
    activeFilters.statusName && `Estado: ${activeFilters.statusName}`,
    activeFilters.modalityName && `Modalidad: ${activeFilters.modalityName}`,
    activeFilters.lineName && `Línea: ${activeFilters.lineName}`,
    activeFilters.semesterName && `Semestre: ${activeFilters.semesterName}`,
    activeFilters.advisorName && `Asesor: ${activeFilters.advisorName}`,
    (activeFilters.startDate || activeFilters.endDate) && `Fechas: ${activeFilters.startDate || 'Inicio'} — ${activeFilters.endDate || 'Hoy'}`,
  ].filter(Boolean);

  if (filterPills.length > 0) {
    autoTable(doc, {
      startY,
      head: [['Filtros aplicados al reporte']],
      body: [[filterPills.join('   •   ')]],
      theme: 'plain',
      headStyles: { fillColor: LIGHT_BG, textColor: DARK_TEXT, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2, textColor: DARK_TEXT, lineColor: [220, 227, 238] },
    });
    startY = getY(doc) + 4;
  }

  // Tabla principal
  const tableData = projects.map((p, idx) => {
    const authors = (p.authors || []).map(a => a.name).filter(Boolean).join(', ') || '—';
    const advisor = (p.advisors || []).map(a => a.name).filter(Boolean).join(', ') || '—';
    const regDate = p.created_at ? new Date(p.created_at).toLocaleDateString('es-CO') : '—';
    const sem = p.semesterNumber ? `${p.semesterNumber}° Sem` : (p.academicPeriod || '—');

    return [
      idx + 1,
      p.code || `PR-${p.id}`,
      p.title || 'Sin título',
      p.programName || '—',
      p.modality || '—',
      p.line || '—',
      p.status || '—',
      sem,
      authors,
      advisor,
      regDate,
    ];
  });

  autoTable(doc, {
    startY,
    head: [['#', 'Código', 'Título del Proyecto', 'Programa', 'Modalidad', 'Línea de Investigación', 'Estado', 'Sem.', 'Autores / Estudiantes', 'Docente Asesor', 'Fecha Reg.']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 1.8, textColor: DARK_TEXT, lineColor: [220, 227, 238] },
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 60 },
      3: { cellWidth: 28 },
      4: { cellWidth: 24 },
      5: { cellWidth: 30 },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 14, halign: 'center' },
      8: { cellWidth: 32 },
      9: { cellWidth: 24 },
      10: { cellWidth: 17, halign: 'center' },
    },
  });

  drawFooter(doc);

  const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  doc.save(`Reporte_Todos_Proyectos_${dateSuffix}.pdf`);
}
