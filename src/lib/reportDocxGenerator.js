import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import { saveAs } from 'file-saver';

const COLOR_PRIMARY = '1F5BA3';
const COLOR_SECONDARY = 'BA1828';
const COLOR_DARK = '182238';
const COLOR_MUTED = '7987A5';
const COLOR_LIGHT_BG = 'F2F5F9';
const COLOR_WHITE = 'FFFFFF';
const COLOR_BORDER = 'DBE3EE';

const tableBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
};

function createCell(text, { isHeader = false, isLabel = false, widthPercent = null, headerColor = COLOR_PRIMARY } = {}) {
  return new TableCell({
    width: widthPercent ? { size: widthPercent, type: WidthType.PERCENTAGE } : undefined,
    borders: tableBorder,
    shading: {
      fill: isHeader ? headerColor : (isLabel ? COLOR_LIGHT_BG : COLOR_WHITE),
    },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: String(text || '-'),
            bold: isHeader || isLabel,
            color: isHeader ? COLOR_WHITE : (isLabel ? COLOR_DARK : COLOR_DARK),
            size: isHeader ? 19 : 18, // 9.5pt or 9pt
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function createSectionHeading(title, color = COLOR_PRIMARY) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 24, // 12pt
        color,
        font: 'Calibri',
      }),
    ],
  });
}

/**
 * Genera el Reporte de un Proyecto Específico en formato Word (.docx)
 */
export async function generateProjectDocx(project, adminUser = {}) {
  if (!project) throw new Error('No hay información del proyecto para generar el documento.');

  const programName = project.programName || (project.authors?.[0]?.program) || 'No especificado';
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const generatedBy = adminUser?.name ? `Generado por: ${adminUser.name}` : 'Generado por: Administrador';

  // 1. Tabla de Información General
  const generalTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createCell('Título del Proyecto:', { isLabel: true, widthPercent: 30 }),
          createCell(project.title || 'Sin título registrado', { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Código:', { isLabel: true, widthPercent: 30 }),
          createCell(project.code || `PR-${project.id}`, { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Estado Actual:', { isLabel: true, widthPercent: 30 }),
          createCell(project.status || 'Sin estado', { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Modalidad de Grado:', { isLabel: true, widthPercent: 30 }),
          createCell(project.modality || 'Sin modalidad', { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Línea de Investigación:', { isLabel: true, widthPercent: 30 }),
          createCell(project.line || 'Sin línea', { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Sublínea de Investigación:', { isLabel: true, widthPercent: 30 }),
          createCell(project.subline || 'Sin sublínea', { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Programa Académico:', { isLabel: true, widthPercent: 30 }),
          createCell(programName, { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Facultad:', { isLabel: true, widthPercent: 30 }),
          createCell(project.facultyName || 'No especificada', { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Semestre / Periodo:', { isLabel: true, widthPercent: 30 }),
          createCell(project.semesterNumber ? `${project.semesterNumber}° Semestre (${project.academicPeriod || ''})` : (project.academicPeriod || 'Sin definir'), { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Fecha de Registro:', { isLabel: true, widthPercent: 30 }),
          createCell(project.created_at ? new Date(project.created_at).toLocaleDateString('es-CO') : 'Sin fecha', { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Fecha de Finalización:', { isLabel: true, widthPercent: 30 }),
          createCell(project.finished_at ? new Date(project.finished_at).toLocaleDateString('es-CO') : 'En desarrollo', { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Carta de Aprobación / Enlace:', { isLabel: true, widthPercent: 30 }),
          createCell(project.letterLink || 'Sin enlace registrado', { widthPercent: 70 }),
        ],
      }),
    ],
  });

  // 2. Tabla de Equipo de Trabajo
  const authorsList = (project.authors || []).map(a => `${a.name || 'Sin nombre'} (${a.email || 'Sin correo'}) - ${a.role || 'Autor'}`).join('\n') || 'Ninguno registrado';
  const advisorsList = (project.advisors || []).map(adv => `${adv.name || 'Sin nombre'} (${adv.email || 'Sin correo'})`).join('\n') || 'Sin asesor asignado';
  const jurorsList = (project.jurors || []).map(j => `${j.name || 'Sin nombre'} (${j.email || 'Sin correo'})`).join('\n') || 'Sin jurados asignados';

  const teamTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createCell('Estudiantes / Autores:', { isLabel: true, widthPercent: 30 }),
          createCell(authorsList, { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Docente Asesor:', { isLabel: true, widthPercent: 30 }),
          createCell(advisorsList, { widthPercent: 70 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Jurados Evaluadores:', { isLabel: true, widthPercent: 30 }),
          createCell(jurorsList, { widthPercent: 70 }),
        ],
      }),
    ],
  });

  // 3. Tabla de Historial
  const historyRows = [
    new TableRow({
      children: [
        createCell('Fecha', { isHeader: true, widthPercent: 20 }),
        createCell('Tipo de Acción', { isHeader: true, widthPercent: 25 }),
        createCell('Descripción del Cambio', { isHeader: true, widthPercent: 55 }),
      ],
    }),
  ];

  const rawHistory = project.history || [];
  if (rawHistory.length === 0) {
    historyRows.push(
      new TableRow({
        children: [
          createCell('-'),
          createCell('CREACIÓN'),
          createCell('Proyecto registrado sin modificaciones posteriores.'),
        ],
      })
    );
  } else {
    rawHistory.forEach(h => {
      historyRows.push(
        new TableRow({
          children: [
            createCell(h.changed_at ? new Date(h.changed_at).toLocaleDateString('es-CO') : '-'),
            createCell(h.change_type || 'MODIFICACIÓN'),
            createCell(h.description || (h.modified_field ? `${h.modified_field}: ${h.old_value || '-'} → ${h.new_value || '-'}` : 'Actualización')),
          ],
        })
      );
    });
  }

  const historyTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: historyRows,
  });

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'UNIVERSIDAD CESMAG — GESTIÓN DE PROYECTOS DE GRADO',
                    bold: true,
                    size: 16,
                    color: COLOR_PRIMARY,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.SPACE_BETWEEN,
                children: [
                  new TextRun({
                    text: 'Universidad CESMAG — Documento oficial de consulta académica',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    text: '   |   Página ',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `REPORTE DE PROYECTO: ${project.code || `PR-${project.id}`}`,
                bold: true,
                size: 32, // 16pt
                color: COLOR_PRIMARY,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Programa: ${programName}  |  Emisión: ${dateStr} ${timeStr}  |  ${generatedBy}`,
                size: 18,
                color: COLOR_MUTED,
                font: 'Calibri',
              }),
            ],
          }),

          createSectionHeading('1. Información General y Académica', COLOR_PRIMARY),
          generalTable,

          createSectionHeading('2. Equipo Vinculado al Proyecto', COLOR_SECONDARY),
          teamTable,

          createSectionHeading('3. Historial y Trazabilidad de Cambios', COLOR_PRIMARY),
          historyTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanCode = (project.code || `PROY_${project.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  saveAs(blob, `Reporte_Proyecto_${cleanCode}_${dateSuffix}.docx`);
}

/**
 * Genera el Reporte Consolidado de Todos los Proyectos en formato Word (.docx)
 */
export async function generateConsolidatedDocx(projects = [], activeFilters = {}, adminUser = {}) {
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error('No hay proyectos para incluir en el reporte consolidado.');
  }

  const programName = activeFilters.programName || (adminUser?.programName) || 'Institucional';
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const generatedBy = adminUser?.name ? `Generado por: ${adminUser.name}` : 'Generado por: Administrador';

  // Tabla consolidada de proyectos
  const tableRows = [
    new TableRow({
      children: [
        createCell('#', { isHeader: true, widthPercent: 4 }),
        createCell('Código', { isHeader: true, widthPercent: 10 }),
        createCell('Título del Proyecto', { isHeader: true, widthPercent: 28 }),
        createCell('Programa', { isHeader: true, widthPercent: 14 }),
        createCell('Modalidad', { isHeader: true, widthPercent: 12 }),
        createCell('Línea', { isHeader: true, widthPercent: 12 }),
        createCell('Estado', { isHeader: true, widthPercent: 10 }),
        createCell('Autores', { isHeader: true, widthPercent: 10 }),
      ],
    }),
  ];

  projects.forEach((p, idx) => {
    const authors = (p.authors || []).map(a => a.name).filter(Boolean).join(', ') || 'Sin autor';
    tableRows.push(
      new TableRow({
        children: [
          createCell(idx + 1),
          createCell(p.code || `PR-${p.id}`),
          createCell(p.title || 'Sin título'),
          createCell(p.programName || '-'),
          createCell(p.modality || '-'),
          createCell(p.line || '-'),
          createCell(p.status || '-'),
          createCell(authors),
        ],
      })
    );
  });

  const consolidatedTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'UNIVERSIDAD CESMAG — REPORTE CONSOLIDADO DE PROYECTOS',
                    bold: true,
                    size: 16,
                    color: COLOR_PRIMARY,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.SPACE_BETWEEN,
                children: [
                  new TextRun({
                    text: 'Universidad CESMAG — Documento oficial de consulta académica',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    text: '   |   Página ',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: 'REPORTE CONSOLIDADO DE PROYECTOS DE GRADO',
                bold: true,
                size: 32,
                color: COLOR_PRIMARY,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: `Programa: ${programName}  |  Total Proyectos: ${projects.length}  |  Emisión: ${dateStr} ${timeStr}  |  ${generatedBy}`,
                size: 18,
                color: COLOR_MUTED,
                font: 'Calibri',
              }),
            ],
          }),

          createSectionHeading('Listado Consolidado de Proyectos', COLOR_PRIMARY),
          consolidatedTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  saveAs(blob, `Reporte_Todos_Proyectos_${dateSuffix}.docx`);
}
