"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { vi } from "@/lib/locale";
import DiscoveryHero from "../../discovery-shell/components/DiscoveryHero";
import DiscoveryIntro from "../../discovery-shell/components/DiscoveryIntro";
import CatalogImage from "../../customer-catalog/components/CatalogImage";
import { formatPrice } from "../../customer-catalog/catalogLogic";
import { SourceNotice, PublicError, Pagination } from "../../public-catalog/Feedback";
import { publicDetailHref } from "../../public-catalog/query";
import { usePublicDiscovery } from "../hooks/usePublicDiscovery";
import shell from "../../discovery-shell/shell.module.css";
import styles from "../discovery.module.css";

function Filters({ state, close }: { state: ReturnType<typeof usePublicDiscovery>; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), title = useId(), description = useId(), t = vi.publicCatalog;
  const [location, setLocation] = useState(state.query.location), [price, setPrice] = useState(state.query.maxPrice), [rating, setRating] = useState(state.query.minRating);
  useEffect(() => { const trigger = document.activeElement, overflow = document.documentElement.style.overflow; document.documentElement.style.overflow = "hidden"; const node = dialog.current; node?.showModal(); node?.querySelector<HTMLInputElement>("input")?.focus(); return () => { document.documentElement.style.overflow = overflow; node?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); }; }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} aria-describedby={description} onCancel={e => { e.preventDefault(); close(); }} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])"));
    if (controls.length === 0) { event.preventDefault(); return; }
    const first = controls[0], last = controls.at(-1), active = document.activeElement;
    if (!(active instanceof HTMLElement) || !controls.includes(active)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
    else if (event.shiftKey && active === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first?.focus(); }
  }}>
    <form onSubmit={e => { e.preventDefault(); state.apply({ location, maxPrice: price, minRating: rating }); close(); }}>
      <div className={styles.dialogHeading}><h2 id={title}>{vi.discovery.filters.title}</h2><button type="button" onClick={close} aria-label={vi.discovery.filters.close}><X aria-hidden="true" /></button></div>
      <p id={description}>{t.filterDescription}</p>
      <label className={styles.publicField}>{t.location}<input value={location} onChange={e => setLocation(e.target.value)} /></label>
      <label className={styles.publicField}>{t.priceBelow}<input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></label>
      <label className={styles.publicField}>{t.rating}<input inputMode="decimal" value={rating} onChange={e => setRating(e.target.value)} /></label>
      <button type="button" className={styles.preset} disabled>{t.availableControl}</button><p>{t.availableReason}</p>
      <button type="submit" className={styles.preset}>{t.apply}</button><button type="button" className={styles.preset} onClick={() => { state.reset(); close(); }}>{vi.discovery.filters.reset}</button>
    </form>
  </dialog>;
}
export default function PublicDiscoveryPage() {
  const state = usePublicDiscovery(), t = vi.publicCatalog, [filters, setFilters] = useState(false);
  const resource = state.result.state, categories = state.categories.state;
  const heading = useRef<HTMLHeadingElement>(null), pageFocus = useRef(false);
  useEffect(() => { if (resource.status === "ready" && pageFocus.current) { pageFocus.current = false; if (document.activeElement === document.body) heading.current?.focus({ preventScroll: true }); } }, [resource.status]);
  return <><DiscoveryHero /><DiscoveryIntro /><section id="results" className={`${shell.container} ${styles.results}`} aria-labelledby="discovery-title">
    <SourceNotice /><h2 id="discovery-title" ref={heading} tabIndex={-1}>{vi.discovery.search.title}</h2>
    <div className={styles.categories} aria-label={vi.discovery.toolbar.categories}>
      <button type="button" aria-pressed={!state.query.categoryId} onClick={() => state.apply({ categoryId: "" })}>{vi.common.actions.all}</button>
      {categories.status === "ready" && categories.data.map(c => <button type="button" key={c.id} aria-pressed={state.query.categoryId === c.id} onClick={() => state.apply({ categoryId: c.id })}>{c.name}</button>)}
    </div>
    {categories.status === "loading" && <p role="status">{t.categoriesLoading}</p>}
    {categories.status === "error" && <PublicError {...categories} onRetry={state.categories.retry} />}
    {state.query.categoryId && categories.status === "ready" && !categories.data.some(c => c.id === state.query.categoryId) && <p role="status">{t.categoryMissing} <button type="button" onClick={() => state.apply({ categoryId: "" })}>{t.removeCondition}</button></p>}
    <div className={styles.searchRow}><label className={styles.search}><Search aria-hidden="true" size={20} /><span className={styles.srOnly}>{t.searchLabel}</span><input type="search" aria-label={t.searchLabel} placeholder={t.searchLabel} value={state.input} onChange={e => state.setSearch(e.target.value)} onCompositionStart={() => state.composition(true)} onCompositionEnd={e => { state.setSearch(e.currentTarget.value); state.composition(false); }} /></label><button type="button" className={styles.filterButton} onClick={() => setFilters(true)}><SlidersHorizontal aria-hidden="true" size={18} />{vi.discovery.toolbar.filters}</button></div>
    <div className={styles.summaryRow}><p>{[state.query.location, state.query.maxPrice && `${t.priceBelow}: ${state.query.maxPrice} ₫`, state.query.minRating && `${t.rating}: ${state.query.minRating}`].filter(Boolean).join(" · ") || t.allConditions}</p><button type="button" onClick={state.reset}>{vi.common.actions.reset}</button><label>{vi.discovery.toolbar.sort}<select value={state.query.sort} onChange={e => state.apply({ sort: e.target.value })}><option value="newest">{t.newest}</option><option value="rating_desc">{vi.discovery.toolbar.rating}</option><option value="price_asc">{t.priceAsc}</option><option value="price_desc">{t.priceDesc}</option>{!["newest", "rating_desc", "price_asc", "price_desc"].includes(state.query.sort) && <option value={state.query.sort}>{t.invalidSort}</option>}</select></label></div>
    {state.notices.length > 0 && <p role="status">{t.canonicalNotice}</p>}
    {state.issues.length > 0 && <div role="alert" className={styles.feedback}><p>{state.issues.map(issue => t.issues[issue as keyof typeof t.issues]).join(" ")}</p>{state.issues.includes("available") && <button type="button" onClick={() => state.removeCondition("available")}>{t.removeAvailable}</button>}{state.issues.includes("duplicate") && <button type="button" onClick={state.deduplicate}>{t.keepFirst}</button>}<button type="button" onClick={state.reset}>{vi.discovery.search.reset}</button></div>}
    <div role="status" aria-live="polite" className={styles.resultStatus}>{state.searching ? vi.discovery.search.waiting : resource.status === "loading" ? vi.discovery.search.loading : resource.status === "ready" ? `${resource.data.meta.totalItems} ${t.providers} · ${t.page} ${resource.data.meta.page}/${resource.data.meta.totalPages || 1}` : ""}</div>
    <div aria-busy={resource.status === "loading"}>
      {resource.status === "loading" && <div className={styles.grid} aria-hidden="true">{[0, 1, 2, 3].map(i => <div key={i} className={styles.skeleton} />)}</div>}
      {resource.status === "error" && <PublicError {...resource} onRetry={state.result.retry} />}
      {(state.emptyPrice && state.issues.length === 0 || resource.status === "ready" && resource.data.items.length === 0) && <div className={styles.feedback}><h3>{vi.discovery.search.emptyTitle}</h3><p>{vi.discovery.search.emptyDescription}</p><button type="button" onClick={state.reset}>{vi.discovery.search.reset}</button></div>}
      {resource.status === "ready" && <><div className={styles.grid}>{resource.data.items.map(provider => <article key={provider.id} className={styles.card} data-provider-id={provider.id}>
        <CatalogImage src={null} alt={provider.businessName} className={styles.cardImage} missingClassName={styles.imageMissing} missingLabel={vi.discovery.card.missingImage} />
        <h3><Link prefetch={false} href={publicDetailHref(provider.id, state.returnTo)}>{provider.businessName}</Link></h3><p className={styles.address}>{provider.address}</p>
        <div className={styles.serviceSummary}><strong>{provider.serviceCount} {t.publicServices}</strong><p>{provider.minPrice === null ? vi.discovery.catalog.unknownPrice : `${t.priceFrom} ${formatPrice(provider.minPrice)}`}{provider.maxPrice !== null && provider.maxPrice !== provider.minPrice ? ` – ${formatPrice(provider.maxPrice)}` : ""}</p></div>
        <p className={styles.rating}>{provider.ratingCount ? `${provider.ratingAvg} / 5 · ${provider.ratingCount} ${t.reviews}` : vi.discovery.catalog.noReviews}</p><p className={styles.description}>{provider.description ?? t.noDescription}</p>
        <Link className={styles.detailLink} prefetch={false} href={publicDetailHref(provider.id, state.returnTo)}>{vi.discovery.card.details}</Link>
      </article>)}</div><Pagination meta={resource.data.meta} disabled={state.searching} onPage={page => { pageFocus.current = true; state.page(page); }} /></>}
    </div>{filters && <Filters state={state} close={() => setFilters(false)} />}
  </section></>;
}
