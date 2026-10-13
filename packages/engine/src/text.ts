/** Folds case and diacritics for search; handles ł/Ł which NFD does not decompose. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function matches(haystack: string, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const h = normalize(haystack);
  return q.split(/\s+/).every((part) => h.includes(part));
}
