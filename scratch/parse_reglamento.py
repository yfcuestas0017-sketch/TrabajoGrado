import pymupdf, json, re

doc = pymupdf.open(r'C:\Users\VANESSA KATHERINE\Downloads\ACUERDO 105 DE 2023 - Por el cual se expide el nuevo Reglamento de trabajo de grado y tesis.pdf')

pages_text = []
for i in range(len(doc)):
    pages_text.append(doc[i].get_text('text'))

raw = '\n'.join(pages_text)

# Remove running headers and standalone page numbers
lines = raw.split('\n')
cleaned = []
skip_phrases = [
    'REGLAMENTO DE TRABAJO DE GRADO Y TESIS DE LA UNIVERSIDAD CESMAG'
]

for l in lines:
    st = l.strip()
    if re.match(r'^\d+$', st):
        continue
    if st in skip_phrases:
        continue
    cleaned.append(l)

clean_text = '\n'.join(cleaned)

acuerda_idx = clean_text.find('ACUERDA:')
preamble = clean_text[:acuerda_idx + len('ACUERDA:')].strip()
body = clean_text[acuerda_idx + len('ACUERDA:'):].strip()

chapters_def = [
    {'number': 'I', 'title': 'GENERALIDADES', 'articles': [1, 2, 3]},
    {'number': 'II', 'title': 'MODALIDADES DE TRABAJO DE GRADO', 'articles': [4, 5, 6]},
    {'number': 'III', 'title': 'ESPACIOS ACADÉMICOS', 'articles': [7, 8, 9, 10, 11]},
    {'number': 'IV', 'title': 'FASES DE DESARROLLO DEL TRABAJO DE GRADO O TESIS', 'articles': list(range(12, 26))},
    {'number': 'V', 'title': 'ASESORES Y JURADOS', 'articles': list(range(26, 37))},
    {'number': 'VI', 'title': 'TIPOS Y CRITERIOS DE DISTINCIONES', 'articles': [37, 38]},
    {'number': 'VII', 'title': 'ESTÍMULOS Y SANCIONES', 'articles': [39, 40]},
    {'number': 'VIII', 'title': 'DISPOSICIONES FINALES', 'articles': [41, 42, 43]},
]

art_to_chap = {}
for ch in chapters_def:
    for a in ch['articles']:
        art_to_chap[a] = ch

art_regex = re.compile(r'ART[IÍ]CULO\s+(\d+)\.?[ \t]*([^\n]*)')
matches = list(art_regex.finditer(body))

articles_list = []
for i in range(len(matches)):
    m = matches[i]
    num = int(m.group(1))
    title_raw = m.group(2).strip()
    start_pos = m.start()
    end_pos = matches[i+1].start() if i + 1 < len(matches) else len(body)
    
    art_text = body[start_pos:end_pos].strip()
    
    # Check modification
    modification = None
    if 'Acuerdo 064' in art_text or 'Modificado por' in art_text:
        modification = {
            'is_modified': True,
            'modifying_agreement': 'Acuerdo 064 del 07 de noviembre de 2024',
            'issuer': 'Consejo Académico de la Universidad CESMAG',
            'date': '2024-11-07',
            'notes': 'Modifica el Artículo 38 (Criterios específicos para el otorgamiento de distinciones especiales en pre y posgrados).'
        }
    
    # Extract Parágrafos
    paragraphs = []
    # Parágrafo or Parágrafos
    par_iter = re.finditer(r'(Par[aá]grafo(?:\s+\d+|\s+Transitorio|\s+[UÚ]nico)?\.?)\s*(.*?)(?=(?:Par[aá]grafo|ART[IÍ]CULO|CAP[IÍ]TULO|$))', art_text, re.DOTALL | re.IGNORECASE)
    for pm in par_iter:
        par_head = pm.group(1).strip()
        par_body = pm.group(2).strip()
        if par_body:
            paragraphs.append({
                'label': par_head,
                'content': par_body
            })
            
    # Extract Numerals / Literals where present
    # (e.g., in Art 6 modalities a, b, c, ... or Art 38 a, b, c, ...)
    literals = []
    lit_iter = re.finditer(r'\n\s*([a-z])\.\s+([^\n]+(?:\n(?!\s*[a-z]\.\s+)[^\n]+)*)', art_text)
    for lm in lit_iter:
        lit_letter = lm.group(1).strip()
        lit_content = lm.group(2).strip()
        # check if it has sub-numerals like 1., 2., ...
        sub_items = []
        sub_iter = re.finditer(r'(?:^|\n)\s*(\d+)\.\s+([^\n]+(?:\n(?!\s*\d+\.\s+)[^\n]+)*)', lit_content)
        for sm in sub_iter:
            sub_items.append({
                'numeral': int(sm.group(1)),
                'content': sm.group(2).strip()
            })
        literals.append({
            'letter': lit_letter,
            'content': lit_content,
            'items': sub_items
        })
        
    title_clean = title_raw
    if 'Modificado por' in title_clean:
        title_clean = title_clean.split('Modificado por')[0]
    title_clean = title_clean.strip('. ')
    title_clean = re.sub(r'^\.\s*', '', title_clean).strip()
    
    chap = art_to_chap.get(num, {'number': 'I', 'title': 'GENERALIDADES'})
    
    chap_num = chap['number']
    articles_list.append({
        'article_number': num,
        'title': title_clean,
        'chapter_number': chap_num,
        'chapter_title': chap['title'],
        'content': art_text,
        'paragraphs': paragraphs,
        'literals': literals,
        'modification': modification,
        'normative_reference': f'Acuerdo 105 de 2023, Capítulo {chap_num}, Artículo {num}'
    })

data = {
    'metadata': {
        'code': 'ACUERDO-105-2023',
        'full_name': 'Acuerdo Número 105 de 2023 (Noviembre 8)',
        'title': 'Reglamento de Trabajo de Grado y Tesis de la Universidad CESMAG',
        'issued_by': 'Consejo Académico de la Universidad CESMAG',
        'issue_date': '2023-11-08',
        'effective_date': '2024-01-01',
        'derogated_agreements': ['Acuerdo 091 de 2023'],
        'compilation_note': 'Versión 2 compilada con el Acuerdo 064 del 07 de noviembre de 2024 del Consejo Académico (Noviembre 2024).',
        'total_chapters': len(chapters_def),
        'total_articles': len(articles_list)
    },
    'chapters': chapters_def,
    'articles': articles_list
}

with open('scratch/reglamento_structured.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('Successfully exported scratch/reglamento_structured.json')
print(f'Total chapters: {len(chapters_def)}, Total articles: {len(articles_list)}')
