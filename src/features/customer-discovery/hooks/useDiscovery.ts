"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMockResource } from "../../customer-catalog/hooks/useMockResource";
import { useCatalogWorkspace } from "../../discovery-shell/CatalogWorkspace";
import { changeCriteria, cleanSearch, defaultQuery, discoveryHref, parseDiscoveryQuery, serializeQuery } from "../queryState";
import type { DiscoveryQuery } from "../../customer-catalog/types";

export function useDiscovery() {
  const params = useSearchParams(); const raw = params.toString();
  const query = useMemo(() => parseDiscoveryQuery(new URLSearchParams(raw)), [raw]);
  const canonical = serializeQuery(query);
  const [draft, setDraft] = useState<{ base: string; value: string } | null>(null);
  const searchInput = draft?.base === raw ? draft.value : query.q;
  const [retry, setRetry] = useState(0);
  const { now, delayMs, faults, clearFault, repository: mockRepository } = useCatalogWorkspace(); const fail = faults.search;
  const navigate = useCallback((next: DiscoveryQuery, method: "push" | "replace") => {
    const href = discoveryHref(next) + (window.location.hash === "#results" ? "#results" : "");
    if (window.location.pathname + window.location.search + window.location.hash !== href) window.history[method === "push" ? "pushState" : "replaceState"](null, "", href);
  }, []);
  useEffect(() => { if (raw !== canonical) navigate(query, "replace"); }, [raw, canonical, query, navigate]);
  useEffect(() => {
    const discard = () => setDraft(null);
    window.addEventListener("popstate", discard);
    return () => window.removeEventListener("popstate", discard);
  }, []);
  useEffect(() => {
    if (draft?.base !== raw || cleanSearch(draft.value) === query.q) return;
    const timer = window.setTimeout(() => navigate(changeCriteria(query, { q: cleanSearch(draft.value) }), "replace"), 350);
    return () => window.clearTimeout(timer);
  }, [draft, raw, query, navigate]);
  const key = JSON.stringify([canonical, now, delayMs, fail, retry]);
  const loader = useCallback((signal: AbortSignal) => mockRepository.search(query, now, { signal, delayMs, fail }), [query, now, delayMs, fail, mockRepository]);
  const resource = useMockResource(key, loader);
  useEffect(() => { if (resource.status === "ready" && resource.data.page !== query.page) navigate({ ...query, page: resource.data.page }, "replace"); }, [resource, query, navigate]);
  function apply(patch: Partial<DiscoveryQuery>) { setDraft(null); navigate(changeCriteria(query, { ...patch, q: cleanSearch(searchInput) }), "push"); }
  return { query, searchInput, setSearch: (value: string) => setDraft({ base: raw, value }), resource,
    apply, applyQuery: (next: DiscoveryQuery) => { setDraft(null); navigate(changeCriteria(next, { q: cleanSearch(searchInput) }), "push"); },
    reset: () => { setDraft(null); navigate({ ...defaultQuery }, "push"); },
    page: (page: number) => { setDraft(null); navigate({ ...query, page }, "push"); },
    retry: () => { clearFault("search"); setRetry(value => value + 1); },
    returnTo: discoveryHref(query), searching: cleanSearch(searchInput) !== query.q,
  };
}
