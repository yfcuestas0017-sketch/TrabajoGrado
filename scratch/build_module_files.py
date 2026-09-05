import json, os, re

with open('scratch/reglamento_structured.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Ensure target directory exists
target_dir = os.path.join('server', 'chatbook', 'regulation')
os.makedirs(target_dir, exist_ok=True)

# 1. GENERATE regulation_data.js
articles = data['articles']
chapters = data['chapters']
metadata = data['metadata']

# Build dedicated modalities list from Art 6
art6 = next(a for a in articles if a['article_number'] == 6)
modalities_list = []
for lit in art6.get('literals', []):
    raw_content = lit['content']
    lines = raw_content.split('\n')
    header_line = lines[0].strip()
    name = header_line.split(':')[0].strip() if ':' in header_line else header_line
    desc = header_line.split(':', 1)[1].strip() if ':' in header_line else '\n'.join(lines[1:]).strip()
    full_desc = raw_content
    modalities_list.append({
        'literal': lit['letter'],
        'name': name,
        'short_description': desc[:250] + ('...' if len(desc) > 250 else ''),
        'full_text': full_desc,
        'article_reference': 'Artículo 6, literal ' + lit['letter']
    })

# Build distinctions list from Art 37 and 38
distinctions_list = [
    {
        'id': 'meritorio_pregrado',
        'name': 'Meritorio (Pregrado)',
        'academic_level': 'Pregrado',
        'awarded_by': 'Consejo Académico, a solicitud del respectivo Consejo de Facultad',
        'score_requirement': 'Nota entre 4.6 y 4.9 en la evaluación de los jurados',
        'requirements_summary': 'Propuesta unánime y motivada; nota entre 4.6 y 4.9; y cumplir con al menos una de las siguientes: semillerista, investigador auxiliar/asistente en grupo de investigación, significativos logros académicos/artísticos/culturales/deportivos, Saber PRO/TyT superiores al promedio del programa, o producción intelectual Minciencias.',
        'modified_by': 'Acuerdo 064 del 07 de noviembre de 2024 (Consejo Académico)',
        'normative_reference': 'Acuerdo 105 de 2023, Artículo 38, literal a (Modificado por Acuerdo 064 de 2024)'
    },
    {
        'id': 'laureado_pregrado',
        'name': 'Laureado (Pregrado)',
        'academic_level': 'Pregrado',
        'awarded_by': 'Consejo Académico, a solicitud del respectivo Consejo de Facultad',
        'score_requirement': 'Nota de 5.0 en la evaluación por parte de los jurados',
        'requirements_summary': 'Propuesta unánime y motivada; nota de 5.0; confirmación de "Laureado" por parte de un tercer jurado elegido por el Comité Curricular; y mérito adicional (semillero, asistente de investigación, Saber PRO/TyT superiores, o producción Minciencias).',
        'modified_by': 'Acuerdo 064 del 07 de noviembre de 2024 (Consejo Académico)',
        'normative_reference': 'Acuerdo 105 de 2023, Artículo 38, literal b (Modificado por Acuerdo 064 de 2024)'
    },
    {
        'id': 'meritorio_maestria',
        'name': 'Meritorio (Maestría)',
        'academic_level': 'Maestría',
        'awarded_by': 'Consejo Académico, a solicitud del respectivo Comité de Maestría',
        'score_requirement': 'Propuesta unánime y motivada de los jurados',
        'requirements_summary': 'Contribución sobresaliente a la disciplina en campo teórico o práctico justificada en acta; culminación del plan de estudios sin exceder la duración prevista; formar parte de un grupo de investigación UNICESMAG; aceptación de otro artículo en revista indexada al menos tipo B (o equivalente Minciencias) como primer autor.',
        'modified_by': 'Acuerdo 064 del 07 de noviembre de 2024 (Consejo Académico)',
        'normative_reference': 'Acuerdo 105 de 2023, Artículo 38, literal c (Modificado por Acuerdo 064 de 2024)'
    },
    {
        'id': 'laureada_maestria',
        'name': 'Laureada (Maestría)',
        'academic_level': 'Maestría',
        'awarded_by': 'Consejo Académico, a solicitud del respectivo Comité de Maestría',
        'score_requirement': 'Propuesta unánime y motivada de los jurados',
        'requirements_summary': 'Documento final escrito en idioma inglés; contribución importante a la disciplina; culminación sin exceder duración prevista; pertenecer a grupo de investigación UNICESMAG; aceptación de otro artículo en revista indexada al menos tipo A (o equivalente) como primer autor.',
        'modified_by': 'Acuerdo 064 del 07 de noviembre de 2024 (Consejo Académico)',
        'normative_reference': 'Acuerdo 105 de 2023, Artículo 38, literal d (Modificado por Acuerdo 064 de 2024)'
    },
    {
        'id': 'cum_laude_doctorado',
        'name': 'Cum Laude (Con Honor - Doctorado)',
        'academic_level': 'Doctorado',
        'awarded_by': 'Consejo Académico, a solicitud del Comité de Doctorado',
        'score_requirement': 'Propuesta unánime y motivada de los jurados',
        'requirements_summary': 'Contribución importante justificada; culminación dentro del tiempo previsto; formar parte de grupo de investigación UNICESMAG; aceptación de otro artículo en revista ISI o SCOPUS (Q1, Q2, Q3) homologada en Publindex como primer autor.',
        'modified_by': 'Acuerdo 064 del 07 de noviembre de 2024 (Consejo Académico)',
        'normative_reference': 'Acuerdo 105 de 2023, Artículo 38, literal e (Modificado por Acuerdo 064 de 2024)'
    },
    {
        'id': 'magna_cum_laude_doctorado',
        'name': 'Magna Cum Laude (Con Gran Honor - Doctorado)',
        'academic_level': 'Doctorado',
        'awarded_by': 'Consejo Académico, a solicitud del Comité de Doctorado',
        'score_requirement': 'Propuesta unánime y motivada de los jurados',
        'requirements_summary': 'Tesis escrita en idioma inglés; contribución importante; tiempo sin exceder duración; grupo de investigación UNICESMAG; aceptación de dos artículos en revista ISI o SCOPUS (Q1, Q2, Q3) como primer autor; no tener modificaciones de fondo en la revisión del jurado.',
        'modified_by': 'Acuerdo 064 del 07 de noviembre de 2024 (Consejo Académico)',
        'normative_reference': 'Acuerdo 105 de 2023, Artículo 38, literal f (Modificado por Acuerdo 064 de 2024)'
    },
    {
        'id': 'summa_cum_laude_doctorado',
        'name': 'Summa Cum Laude (Con el Máximo Honor - Doctorado)',
        'academic_level': 'Doctorado',
        'awarded_by': 'Consejo Académico, a solicitud del Comité de Doctorado',
        'score_requirement': 'Propuesta unánime y motivada de los jurados',
        'requirements_summary': 'Tesis escrita en idioma inglés; contribución importante; culminación dentro del tiempo previsto; grupo de investigación UNICESMAG; aceptación de tres artículos en revista ISI o SCOPUS (Q1, Q2, Q3) como primer autor; no tener modificaciones de fondo en la revisión del jurado.',
        'modified_by': 'Acuerdo 064 del 07 de noviembre de 2024 (Consejo Académico)',
        'normative_reference': 'Acuerdo 105 de 2023, Artículo 38, literal g (Modificado por Acuerdo 064 de 2024)'
    }
]

# Build modifications log
modifications_log = [
    {
        'modifying_agreement': 'Acuerdo 064 del 07 de noviembre de 2024',
        'issuing_body': 'Consejo Académico de la Universidad CESMAG',
        'date': '2024-11-07',
        'affected_article': 38,
        'article_title': 'CRITERIOS (Distinciones especiales)',
        'scope': 'Modificación integral de los criterios y condiciones para otorgar distinciones de Meritorio, Laureado, Cum Laude, Magna Cum Laude y Summa Cum Laude en programas de pregrado, maestrías y doctorados.',
        'compilation_note': 'Incluido en la Versión 2 de la compilación oficial de Noviembre 2024.'
    }
]

regulation_data_content = f'''/**
 * FUENTE NORMATIVA OFICIAL — REGLAMENTO DE TRABAJO DE GRADO Y TESIS
 * UNIVERSIDAD CESMAG
 *
 * Acuerdo Número 105 de 2023 (Noviembre 8 de 2023)
 * Compilación oficial: Versión 2 con modificaciones del Acuerdo 064 de 2024 (Noviembre 7 de 2024)
 *
 * ESTRUCTURA INDEPENDIENTE PARA CONSULTA NORMATIVA DEL BACKEND
 * Diseñada para permitir su migración futura a PostgreSQL/Supabase de manera transparente.
 */

export const REGULATION_METADATA = {json.dumps(metadata, ensure_ascii=False, indent=2)};

export const REGULATION_CHAPTERS = {json.dumps(chapters, ensure_ascii=False, indent=2)};

export const REGULATION_MODALITIES = {json.dumps(modalities_list, ensure_ascii=False, indent=2)};

export const REGULATION_DISTINCTIONS = {json.dumps(distinctions_list, ensure_ascii=False, indent=2)};

export const REGULATION_MODIFICATIONS_LOG = {json.dumps(modifications_log, ensure_ascii=False, indent=2)};

export const REGULATION_ARTICLES = {json.dumps(articles, ensure_ascii=False, indent=2)};
'''

data_file_path = os.path.join(target_dir, 'regulation_data.js')
with open(data_file_path, 'w', encoding='utf-8') as f:
    f.write(regulation_data_content)

print(f'Created {data_file_path}')
