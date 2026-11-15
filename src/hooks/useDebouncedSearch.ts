import { useEffect, useState } from "react";

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Returns `query` once the user stops typing for `delay` ms.
 * Clearing the query applies immediately so "Xóa bộ lọc" never shows stale results.
 */
export function useDebouncedSearch(query: string, delay = SEARCH_DEBOUNCE_MS): string {
  const [debounced, setDebounced] = useState(query);
  const cleared = !query.trim();
  if (cleared && debounced !== query) setDebounced(query);

  useEffect(() => {
    if (cleared) return;
    const timer = window.setTimeout(() => setDebounced(query), delay);
    return () => window.clearTimeout(timer);
  }, [query, cleared, delay]);

  return cleared ? query : debounced;
}
