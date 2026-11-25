"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isRequestCancelled } from "../../lib/api/errors";
import { usePublicCatalog } from "./PublicCatalogProvider";
import { PublicRequest, publicKey } from "./resource";

export function usePublicResource<T>(resource: string, wire: string | null, loader: (signal: AbortSignal) => Promise<T>, freshness = 30_000) {
  const { cache } = usePublicCatalog();
  const [owner] = useState(() => new PublicRequest());
  const [attempt, setAttempt] = useState(0);
  const key = wire === null ? null : JSON.stringify([resource, wire, attempt]);
  const current = useRef<string | null>(null);
  useLayoutEffect(() => { current.current = key; return () => { current.current = null; owner.cancel(); }; }, [key, owner]);
  const [state, setState] = useState<{ key: string; status: "ready"; data: T } | { key: string; status: "error"; error: unknown; failedAt: number } | null>(null);
  useEffect(() => {
    if (key === null || wire === null) return;
    let mounted = true;
    owner.run(cache, publicKey(resource, wire), loader, () => mounted && current.current === key, freshness).then(data => {
      if (mounted && current.current === key) setState({ key, status: "ready", data });
    }, error => {
      if (mounted && current.current === key && !isRequestCancelled(error)) setState({ key, status: "error", error, failedAt: Date.now() });
    });
    return () => { mounted = false; owner.cancel(); };
  }, [key, wire, resource, loader, freshness, cache, owner]);
  return { state: key === null ? { status: "disabled" as const } : state?.key === key ? state : { status: "loading" as const }, cancel: () => owner.cancel(), retry: () => { owner.cancel(); if (wire !== null) cache.invalidate(publicKey(resource, wire)); setAttempt(n => n + 1); } };
}
