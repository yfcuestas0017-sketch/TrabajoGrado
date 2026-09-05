/**
 * MOTOR DE BÚSQUEDA NORMATIVA — REGLAMENTO DE TRABAJO DE GRADO Y TESIS
 * UNIVERSIDAD CESMAG
 *
 * Fuente normativa:
 * - Acuerdo 105 de 2023 (Noviembre 8 de 2023)
 * - Modificaciones: Acuerdo 064 de 2024 (Noviembre 7 de 2024)
 *
 * Permite buscar por:
 * - Texto libre / Contenido
 * - Palabras clave
 * - Capítulo (número romano o título)
 * - Artículo (número específico)
 * - Título del artículo
 * - Modalidades / Opciones de grado (Artículo 6)
 * - Distinciones académicas (Artículos 37 y 38)
 * - Parágrafos y numerales/literales
 */

import {
  REGULATION_METADATA,
  REGULATION_CHAPTERS,
  REGULATION_ARTICLES,
  REGULATION_MODALITIES,
  REGULATION_DISTINCTIONS,
  REGULATION_MODIFICATIONS_LOG,
} from './regulation_data.js';

/**
 * Normaliza una cadena de texto eliminando acentos, puntuación y convirtiendo a minúsculas
 */
export function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokeniza una consulta en palabras clave significativas (removiendo stop words básicas)
 */
export function tokenizeQuery(query) {
  const norm = normalizeText(query);
  if (!norm) return [];
  const stopWords = new Set([
    'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'e',
    'en', 'a', 'para', 'por', 'con', 'sin', 'sobre', 'del', 'al', 'que', 'se',
    'su', 'sus', 'como', 'cual', 'cuales', 'donde', 'cuando', 'quien', 'quienes',
    'dice', 'habla', 'menciona', 'establece', 'estipula', 'cuenta', 'reglamento', 'acuerdo'
  ]);
  return norm
    .split(' ')
    .filter(token => token.length > 2 && !stopWords.has(token));
}

/**
 * Obtiene un artículo específico por su número (1 al 43)
 */
export function getArticleByNumber(articleNumber) {
  const num = parseInt(articleNumber, 10);
  if (isNaN(num) || num < 1 || num > 43) return null;
  return REGULATION_ARTICLES.find(a => a.article_number === num) || null;
}

/**
 * Obtiene los artículos de un capítulo específico por número romano o arábigo
 */
export function getArticlesByChapter(chapterNumberOrRoman) {
  const romanMap = {
    '1': 'I', '2': 'II', '3': 'III', '4': 'IV',
    '5': 'V', '6': 'VI', '7': 'VII', '8': 'VIII'
  };
  const rawInput = String(chapterNumberOrRoman || '').toUpperCase().trim();
  const roman = romanMap[rawInput] || rawInput;

  const chapterDef = REGULATION_CHAPTERS.find(c => c.number.toUpperCase() === roman);
  if (!chapterDef) return [];

  return REGULATION_ARTICLES.filter(a => a.chapter_number.toUpperCase() === roman);
}

/**
 * Obtiene información de un capítulo por número o nombre
 */
export function getChapterInfo(chapterIdentifier) {
  const norm = normalizeText(chapterIdentifier);
  const romanMap = {
    '1': 'I', '2': 'II', '3': 'III', '4': 'IV',
    '5': 'V', '6': 'VI', '7': 'VII', '8': 'VIII',
    'i': 'I', 'ii': 'II', 'iii': 'III', 'iv': 'IV',
    'v': 'V', 'vi': 'VI', 'vii': 'VII', 'viii': 'VIII'
  };

  const directRoman = romanMap[norm];
  if (directRoman) {
    const chap = REGULATION_CHAPTERS.find(c => c.number === directRoman);
    if (chap) {
      return {
        ...chap,
        articles_count: chap.articles.length,
        articles_details: REGULATION_ARTICLES.filter(a => a.chapter_number === directRoman)
      };
    }
  }

  // Búsqueda por título de capítulo
  const chapByTitle = REGULATION_CHAPTERS.find(c => normalizeText(c.title).includes(norm));
  if (chapByTitle) {
    return {
      ...chapByTitle,
      articles_count: chapByTitle.articles.length,
      articles_details: REGULATION_ARTICLES.filter(a => a.chapter_number === chapByTitle.number)
    };
  }

  return null;
}

/**
 * Busca modalidades de grado específicas en el catálogo oficial (Artículo 6)
 */
export function searchModalities(query) {
  const norm = normalizeText(query);
  if (!norm) return [];
  const tokens = tokenizeQuery(query);

  return REGULATION_MODALITIES.filter(m => {
    const nameNorm = normalizeText(m.name);
    const descNorm = normalizeText(m.full_text);
    return (
      nameNorm.includes(norm) ||
      norm.includes(nameNorm) ||
      (tokens.length > 0 && tokens.some(t => nameNorm.includes(t)))
    );
  });
}

/**
 * Busca distinciones de grado (Meritorio, Laureado, Cum Laude, etc.) (Artículos 37 y 38)
 */
export function searchDistinctions(query) {
  const norm = normalizeText(query);
  if (!norm) return [];

  return REGULATION_DISTINCTIONS.filter(d => {
    const nameNorm = normalizeText(d.name);
    const levelNorm = normalizeText(d.academic_level);
    const summaryNorm = normalizeText(d.requirements_summary);
    return nameNorm.includes(norm) || levelNorm.includes(norm) || summaryNorm.includes(norm);
  });
}

/**
 * Busca artículos por palabras clave exactas o parciales
 */
export function searchByKeywords(keywordsArray) {
  if (!Array.isArray(keywordsArray) || keywordsArray.length === 0) return [];
  const normalizedKeys = keywordsArray.map(normalizeText);

  return REGULATION_ARTICLES.filter(article => {
    const artKeywords = (article.keywords || []).map(normalizeText);
    return normalizedKeys.some(k => artKeywords.some(ak => ak.includes(k) || k.includes(ak)));
  });
}

/**
 * Función principal de búsqueda normativa.
 * Evalúa relevancia y devuelve resultados estructurados con referencias completas.
 *
 * @param {string} query - Término de búsqueda en lenguaje natural o palabras clave
 * @param {Object} options - Filtros opcionales { chapter, articleNumber, modalityOnly, limit }
 * @returns {Object} Respuesta estructurada con resultados o mensaje controlado si no hay coincidencias
 */
export function searchRegulation(query, options = {}) {
  const { chapter = null, articleNumber = null, modalityOnly = false, limit = 10 } = options;
  const rawQuery = String(query || '').trim();
  const normQuery = normalizeText(rawQuery);
  const tokens = tokenizeQuery(rawQuery);

  if (!rawQuery && !chapter && !articleNumber) {
    return {
      success: false,
      count: 0,
      query: rawQuery,
      message: 'Debe proporcionar un término de búsqueda, número de artículo o capítulo.',
      results: []
    };
  }

  // 1. Consulta directa por número de artículo
  if (articleNumber !== null || /^art[ií]culo\s+(\d+)$/i.test(rawQuery) || /^art\.?\s*(\d+)$/i.test(rawQuery)) {
    const numMatch = rawQuery.match(/(\d+)/);
    const targetNum = articleNumber !== null ? parseInt(articleNumber, 10) : (numMatch ? parseInt(numMatch[1], 10) : null);
    if (targetNum && targetNum >= 1 && targetNum <= 43) {
      const art = getArticleByNumber(targetNum);
      if (art) {
        return {
          success: true,
          count: 1,
          query: rawQuery,
          message: `Artículo ${targetNum} encontrado en el Reglamento de Trabajo de Grado y Tesis.`,
          results: [{
            chapter_number: art.chapter_number,
            chapter_title: art.chapter_title,
            article_number: art.article_number,
            title: art.title,
            content: art.content,
            paragraphs: art.paragraphs || [],
            literals: art.literals || [],
            keywords: art.keywords || [],
            modification: art.modification || null,
            normative_reference: art.normative_reference,
            relevance_score: 100
          }]
        };
      }
    }
  }

  // 2. Consulta de modalidades de grado si aplica
  const asksAllModalities = /\b(que modalidades|cuales son las modalidades|que opciones de grado|cuales son las opciones de grado|modalidades de grado|opciones de grado|modalidades existen|opciones existen)\b/i.test(normQuery);
  if (modalityOnly || asksAllModalities || /\b(modalidad|modalidades|opcion de grado|opciones de grado|coterminalidad|pasantia|monografia|certificacion|creacion de empresa|consultoria)\b/i.test(normQuery)) {
    let matchedModalities = searchModalities(rawQuery);
    if (asksAllModalities || matchedModalities.length === 0) {
      matchedModalities = [...REGULATION_MODALITIES];
    }
    if (matchedModalities.length > 0 && !/\b(sustentacion|jurado|distincion|sancion|asesor|espacio)\b/i.test(normQuery)) {
      const art6 = getArticleByNumber(6);
      return {
        success: true,
        count: matchedModalities.length,
        query: rawQuery,
        message: `Se encontraron ${matchedModalities.length} modalidad(es) en el Artículo 6 del Reglamento.`,
        modalities: matchedModalities,
        results: [{
          chapter_number: art6.chapter_number,
          chapter_title: art6.chapter_title,
          article_number: art6.article_number,
          title: art6.title,
          content: art6.content,
          matched_modalities: matchedModalities,
          paragraphs: art6.paragraphs || [],
          literals: art6.literals || [],
          keywords: art6.keywords || [],
          modification: art6.modification || null,
          normative_reference: art6.normative_reference,
          relevance_score: 95
        }]
      };
    }
  }

  // 3. Consulta de distinciones académicas (Meritorio, Laureado, Cum Laude)
  if (/\b(meritorio|laureado|laureada|cum laude|magna cum laude|summa cum laude|distincion|distinciones)\b/i.test(normQuery)) {
    const matchedDistinctions = searchDistinctions(rawQuery);
    const art37 = getArticleByNumber(37);
    const art38 = getArticleByNumber(38);
    const distinctionResults = [];

    if (art38) {
      distinctionResults.push({
        chapter_number: art38.chapter_number,
        chapter_title: art38.chapter_title,
        article_number: art38.article_number,
        title: art38.title,
        content: art38.content,
        paragraphs: art38.paragraphs || [],
        literals: art38.literals || [],
        keywords: art38.keywords || [],
        modification: art38.modification || null,
        normative_reference: art38.normative_reference,
        relevance_score: 95
      });
    }

    if (art37 && !normQuery.includes('criterio')) {
      distinctionResults.push({
        chapter_number: art37.chapter_number,
        chapter_title: art37.chapter_title,
        article_number: art37.article_number,
        title: art37.title,
        content: art37.content,
        paragraphs: art37.paragraphs || [],
        literals: art37.literals || [],
        keywords: art37.keywords || [],
        modification: null,
        normative_reference: art37.normative_reference,
        relevance_score: 85
      });
    }

    if (distinctionResults.length > 0) {
      return {
        success: true,
        count: distinctionResults.length,
        query: rawQuery,
        message: `Se encontraron ${distinctionResults.length} artículo(s) sobre distinciones en el Capítulo VI.`,
        distinctions: matchedDistinctions,
        results: distinctionResults
      };
    }
  }

  // 4. Búsqueda general calificada en todos los artículos
  const scoredArticles = [];

  for (const article of REGULATION_ARTICLES) {
    // Filtro opcional por capítulo
    if (chapter) {
      const chapRoman = String(chapter).toUpperCase();
      if (article.chapter_number.toUpperCase() !== chapRoman) continue;
    }

    let score = 0;
    const titleNorm = normalizeText(article.title);
    const contentNorm = normalizeText(article.content);
    const keywordsNorm = (article.keywords || []).map(normalizeText);

    // Coincidencia exacta de frase en título
    if (normQuery && titleNorm.includes(normQuery)) {
      score += 100;
    }

    // Coincidencia exacta de frase en contenido
    if (normQuery && contentNorm.includes(normQuery)) {
      score += 40;
    }

    // Coincidencia en palabras clave
    for (const kw of keywordsNorm) {
      if (normQuery && (kw.includes(normQuery) || normQuery.includes(kw))) {
        score += 45;
      }
    }

    // Conteo de tokens coincidentes en el título
    let matchedTitleTokens = 0;
    for (const token of tokens) {
      if (titleNorm.includes(token)) {
        matchedTitleTokens++;
        score += 30;
      }
      if (keywordsNorm.some(kw => kw.includes(token))) score += 15;
      if (contentNorm.includes(token)) score += 4;
    }

    // Si coincide con múltiples tokens en el título (ej: "conforma" y "jurado" en "CONFORMACIÓN DEL JURADO EVALUADOR")
    if (tokens.length >= 2 && matchedTitleTokens >= 2) {
      score += 80;
    }

    // Coincidencia en parágrafos específicos
    const matchedParagraphs = [];
    if (Array.isArray(article.paragraphs)) {
      for (const p of article.paragraphs) {
        const pNorm = normalizeText(p.content);
        if (tokens.some(t => pNorm.includes(t)) || (normQuery && pNorm.includes(normQuery))) {
          matchedParagraphs.push(p);
          score += 10;
        }
      }
    }

    // Coincidencia en literales específicos
    const matchedLiterals = [];
    if (Array.isArray(article.literals)) {
      for (const lit of article.literals) {
        const litNorm = normalizeText(lit.content);
        if (tokens.some(t => litNorm.includes(t)) || (normQuery && litNorm.includes(normQuery))) {
          matchedLiterals.push(lit);
          score += 10;
        }
      }
    }

    // Solo incluir si tiene una puntuación significativa
    if (score >= 15) {
      scoredArticles.push({
        chapter_number: article.chapter_number,
        chapter_title: article.chapter_title,
        article_number: article.article_number,
        title: article.title,
        content: article.content,
        paragraphs: article.paragraphs || [],
        matched_paragraphs: matchedParagraphs,
        literals: article.literals || [],
        matched_literals: matchedLiterals,
        keywords: article.keywords || [],
        modification: article.modification || null,
        normative_reference: article.normative_reference,
        relevance_score: score
      });
    }
  }

  // Ordenar por relevancia descendente
  scoredArticles.sort((a, b) => b.relevance_score - a.relevance_score);

  const limitedResults = scoredArticles.slice(0, limit);

  if (limitedResults.length === 0) {
    return {
      success: false,
      count: 0,
      query: rawQuery,
      message: `No se encontró información normativa relacionada con "${rawQuery}" en el Reglamento de Trabajo de Grado y Tesis (Acuerdo 105 de 2023).`,
      results: []
    };
  }

  return {
    success: true,
    count: limitedResults.length,
    total_matches: scoredArticles.length,
    query: rawQuery,
    message: `Se encontraron ${limitedResults.length} resultado(s) normativo(s).`,
    results: limitedResults
  };
}
