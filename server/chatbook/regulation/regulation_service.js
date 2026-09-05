/**
 * SERVICIO DE CONSULTA DEL REGLAMENTO — REGLAMENTO DE TRABAJO DE GRADO Y TESIS
 * UNIVERSIDAD CESMAG
 *
 * Fuente: Acuerdo 105 de 2023 (Compilado con Acuerdo 064 de 2024)
 *
 * Capa de servicio desacoplada para proveer acceso unificado a la información normativa.
 * Diseñada para permitir alternar entre el proveedor estático en memoria y un proveedor
 * de base de datos (PostgreSQL/Supabase) en pasos futuros sin alterar el contrato de servicio.
 */

import {
  REGULATION_METADATA,
  REGULATION_CHAPTERS,
  REGULATION_ARTICLES,
  REGULATION_MODALITIES,
  REGULATION_DISTINCTIONS,
  REGULATION_MODIFICATIONS_LOG,
} from './regulation_data.js';

import {
  getArticleByNumber,
  getArticlesByChapter,
  getChapterInfo,
  searchModalities,
  searchDistinctions,
  searchByKeywords,
  searchRegulation as executeSearch,
  normalizeText,
} from './regulation_search.js';

/**
 * Proveedor estático de datos normativos en memoria
 */
class StaticRegulationProvider {
  async getMetadata() {
    return { ...REGULATION_METADATA };
  }

  async getChapters() {
    return [...REGULATION_CHAPTERS];
  }

  async getChapter(chapterIdentifier) {
    return getChapterInfo(chapterIdentifier);
  }

  async getArticle(articleNumber) {
    return getArticleByNumber(articleNumber);
  }

  async getAllArticles() {
    return [...REGULATION_ARTICLES];
  }

  async getModalities() {
    return [...REGULATION_MODALITIES];
  }

  async getModality(nameOrLiteral) {
    const norm = normalizeText(nameOrLiteral);
    const directLiteral = REGULATION_MODALITIES.find(m => m.literal.toLowerCase() === norm);
    if (directLiteral) return directLiteral;

    const matches = searchModalities(nameOrLiteral);
    return matches.length > 0 ? matches[0] : null;
  }

  async getDistinctions() {
    return [...REGULATION_DISTINCTIONS];
  }

  async getModifications() {
    return [...REGULATION_MODIFICATIONS_LOG];
  }

  async search(query, options = {}) {
    return executeSearch(query, options);
  }
}

// Instancia por defecto del proveedor
const defaultProvider = new StaticRegulationProvider();

/**
 * Clase principal del servicio normativo
 */
export class RegulationService {
  constructor(provider = defaultProvider) {
    this.provider = provider;
  }

  /**
   * Obtiene la metadata del reglamento oficial
   */
  async getMetadata() {
    return await this.provider.getMetadata();
  }

  /**
   * Obtiene todos los capítulos del reglamento
   */
  async getChapters() {
    return await this.provider.getChapters();
  }

  /**
   * Obtiene información detallada de un capítulo por número romano (ej: "II") o número (ej: 2) o título
   */
  async getChapter(chapterIdentifier) {
    return await this.provider.getChapter(chapterIdentifier);
  }

  /**
   * Obtiene un artículo específico por su número (1 a 43)
   */
  async getArticle(articleNumber) {
    return await this.provider.getArticle(articleNumber);
  }

  /**
   * Obtiene la totalidad de los 43 artículos
   */
  async getAllArticles() {
    return await this.provider.getAllArticles();
  }

  /**
   * Obtiene el catálogo completo de las 18 modalidades de grado oficiales (Artículo 6)
   */
  async getModalities() {
    return await this.provider.getModalities();
  }

  /**
   * Obtiene una modalidad de grado específica por nombre o literal
   */
  async getModality(nameOrLiteral) {
    return await this.provider.getModality(nameOrLiteral);
  }

  /**
   * Obtiene el catálogo de distinciones académicas (Meritorio, Laureado, Cum Laude, etc.)
   */
  async getDistinctions() {
    return await this.provider.getDistinctions();
  }

  /**
   * Obtiene el historial de modificaciones normativas (Acuerdo 064 de 2024, etc.)
   */
  async getModifications() {
    return await this.provider.getModifications();
  }

  /**
   * Realiza una búsqueda estructurada en el reglamento por texto, palabras clave, artículo o modalidad
   *
   * @param {string} query - Consulta del usuario o término de búsqueda
   * @param {Object} options - Opciones de filtrado ({ chapter, articleNumber, modalityOnly, limit })
   * @returns {Promise<Object>} Objeto estructurado con los resultados encontrados o mensaje controlado
   */
  async search(query, options = {}) {
    return await this.provider.search(query, options);
  }

  /**
   * Genera una cita formal de referencia normativa institucional
   */
  formatCitation(articleNumber, extraDetail = '') {
    const num = parseInt(articleNumber, 10);
    const art = getArticleByNumber(num);
    if (!art) return 'Reglamento de Trabajo de Grado y Tesis (Acuerdo 105 de 2023, Universidad CESMAG)';

    let citation = `${art.normative_reference} - "${art.title}" (Universidad CESMAG)`;
    if (extraDetail) {
      citation += `, ${extraDetail}`;
    }
    if (art.modification) {
      citation += ` [${art.modification.modifying_agreement}]`;
    }
    return citation;
  }
}

// Instancia exportada por defecto para uso directo
export const regulationService = new RegulationService();

// Exportaciones auxiliares directas
export {
  StaticRegulationProvider,
  getArticleByNumber,
  getArticlesByChapter,
  getChapterInfo,
  searchModalities,
  searchDistinctions,
  searchByKeywords,
  executeSearch as searchRegulation
};
