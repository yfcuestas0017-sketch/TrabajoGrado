// ── UTILIDAD ─────────────────────────────────────────────
export function generatePrefix(lineName) {
  if (!lineName) return 'PR';
  // Palabras menores a ignorar al formar el acrónimo
  const ignoredWords = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'para', 'con', 'en']);
  const words = lineName.split(/\s+/);
  const letters = words
    .filter(w => !ignoredWords.has(w.toLowerCase()))
    .map(w => w.charAt(0).toUpperCase());
  return letters.join('');
}

export default generatePrefix;
