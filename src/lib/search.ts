/** Lowercases, strips Vietnamese accents (including đ/Đ) and collapses whitespace. */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
}

/** `query` must already be normalized; an empty query matches everything. */
export function matchesSearch(query: string, fields: readonly string[]): boolean {
  return !query || normalizeSearch(fields.join(" ")).includes(query);
}
