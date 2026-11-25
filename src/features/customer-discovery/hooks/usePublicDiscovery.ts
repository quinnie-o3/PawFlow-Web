"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePublicCatalog } from "../../public-catalog/PublicCatalogProvider";
import { usePublicResource } from "../../public-catalog/usePublicResource";
import { parseSearch, searchWire, serializeSearch, type SearchQuery } from "../../public-catalog/query";

export function usePublicDiscovery() {
  const raw = useSearchParams().toString(), parsed = useMemo(() => parseSearch(new URLSearchParams(raw)), [raw]);
  const { query } = parsed, { api } = usePublicCatalog();
  const [draft, setDraft] = useState<{ base: string; value: string } | null>(null), [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState({ raw, values: parsed.notices });
  if (parsed.notices.length && notice.raw !== raw) setNotice({ raw, values: parsed.notices });
  const input = draft?.base === raw ? draft.value : query.q, searching = input.trim() !== query.q || composing;
  const navigate = useCallback((search: string, method: "push" | "replace") => {
    const href = "/discover" + (search ? "?" + search : "") + (window.location.hash === "#results" ? "#results" : "");
    if (window.location.pathname + window.location.search + window.location.hash !== href) window.history[method === "push" ? "pushState" : "replaceState"](null, "", href);
  }, []);
  useEffect(() => { if (raw !== parsed.canonical) navigate(parsed.canonical, "replace"); }, [raw, parsed, navigate]);
  useEffect(() => { const discard = () => { setDraft(null); setComposing(false); }; window.addEventListener("popstate", discard); return () => window.removeEventListener("popstate", discard); }, []);
  const apply = useCallback((patch: Partial<SearchQuery>, method: "push" | "replace" = "push") => {
    const p = new URLSearchParams(raw);
    for (const [key, value] of Object.entries({ ...patch, q: input.trim(), page: 1 })) { p.delete(key); if (value !== "" && !(key === "page" && value === 1)) p.set(key, String(value)); }
    setDraft(null); navigate(p.toString(), method);
  }, [raw, input, navigate]);
  useEffect(() => { if (!searching || composing) return; const timer = setTimeout(() => apply({ q: input.trim() }, "replace"), 350); return () => clearTimeout(timer); }, [searching, composing, input, apply]);
  const wire = parsed.issues.length || searching || parsed.emptyPrice ? null : searchWire(query);
  const load = useCallback((signal: AbortSignal) => api.providers(wire!, signal), [api, wire]);
  const result = usePublicResource("providers", wire, load);
  const loadCategories = useCallback((signal: AbortSignal) => api.categories(signal), [api]);
  const categories = usePublicResource("categories", "active", loadCategories);
  const clamp = useRef({ criteria: "", done: false });
  const criteria = serializeSearch({ ...query, page: 1 });
  useEffect(() => {
    if (clamp.current.criteria !== criteria) clamp.current = { criteria, done: false };
    if (result.state.status !== "ready" || clamp.current.done) return;
    const last = Math.max(1, Math.min(1000, result.state.data.meta.totalPages));
    if (query.page > last) { clamp.current.done = true; navigate(serializeSearch({ ...query, page: last }), "replace"); }
  }, [result.state, query, criteria, navigate]);
  return { ...parsed, input, searching, notices: notice.values, result, categories, apply,
    setSearch: (value: string) => { if (value.trim() !== query.q) result.cancel(); setDraft({ base: raw, value }); },
    composition: (active: boolean) => { if (active) result.cancel(); setComposing(active); },
    page: (page: number) => { if (!searching && !parsed.issues.length) navigate(serializeSearch({ ...query, page }), "push"); },
    reset: () => { result.cancel(); setDraft(null); setNotice({ raw: "", values: [] }); navigate("", "push"); },
    removeCondition: (key: string) => { const p = new URLSearchParams(raw); p.delete(key); p.delete("page"); navigate(p.toString(), "push"); },
    deduplicate: () => { const p = new URLSearchParams(raw); for (const key of new Set(p.keys())) { const first = p.get(key)!; p.delete(key); p.set(key, first); } navigate(p.toString(), "push"); },
    returnTo: "/discover" + (parsed.canonical ? "?" + parsed.canonical : ""),
  };
}
