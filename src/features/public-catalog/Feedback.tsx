"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { vi } from "../../lib/locale";
import { ApiError } from "../../lib/api/errors";
import { PublicTimeout } from "./resource";
import { pageWindow } from "./query";
import type { Meta } from "./api";
import styles from "../customer-discovery/discovery.module.css";

export function SourceNotice({ demo = false }: { demo?: boolean }) {
  const t = vi.publicCatalog;
  return <p className={styles.petNotice} data-catalog-source={demo ? "demo" : "live"}>{demo ? t.demo : t.live} <Link href={demo ? "/discover" : "/discover?catalog=demo"} prefetch={false}>{demo ? t.openLive : t.openDemo}</Link></p>;
}
export function PublicError({ error, failedAt, onRetry }: { error: unknown; failedAt: number; onRetry: () => void }) {
  const t = vi.publicCatalog, [now, setNow] = useState(() => Date.now());
  const seconds = error instanceof ApiError ? error.retryAfterSeconds ?? 0 : 0;
  const remaining = Math.max(0, Math.ceil((failedAt + seconds * 1000 - now) / 1000));
  useEffect(() => { if (!seconds) return; const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer); }, [seconds, failedAt]);
  const message = error instanceof PublicTimeout ? t.timeout : error instanceof ApiError ? error.status === 404 ? t.notFound : error.status === 400 ? t.invalidRequest : error.status === 429 ? t.rateLimited : error.status === 503 ? t.unavailable : error.kind === "config" ? t.config : error.kind === "invalid-response" ? t.invalidResponse : error.kind === "network" ? t.network : t.error : t.error;
  return <div role="alert" className={styles.feedback}><p>{message}</p>{remaining > 0 && <p role="status">{t.wait.replace("{seconds}", String(remaining))}</p>}<button type="button" disabled={remaining > 0} onClick={onRetry}>{vi.common.actions.retry}</button></div>;
}
export function Pagination({ meta, disabled = false, onPage }: { meta: Meta; disabled?: boolean; onPage: (page: number) => void }) {
  if (meta.totalPages <= 1) return null;
  return <nav className={styles.pagination} aria-label={vi.discovery.search.pagination}>
    <button type="button" disabled={disabled || meta.page <= 1} onClick={() => onPage(meta.page - 1)}>{vi.discovery.search.previous}</button>
    {pageWindow(meta.page, meta.totalPages).map(page => <button type="button" key={page} disabled={disabled} aria-current={meta.page === page ? "page" : undefined} aria-label={vi.discovery.search.pageLabel.replace("{page}", String(page))} onClick={() => onPage(page)}>{page}</button>)}
    <button type="button" disabled={disabled || !meta.hasNextPage || meta.page >= 1000} onClick={() => onPage(meta.page + 1)}>{vi.discovery.search.next}</button>
  </nav>;
}
