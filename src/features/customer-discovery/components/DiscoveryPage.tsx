"use client";

import { vi, formatMessage } from "@/lib/locale";

import { useState } from "react";
import { ArrowLeft, ArrowRight, SearchX, RefreshCw } from "lucide-react";
import DiscoveryHero from "../../discovery-shell/components/DiscoveryHero";
import DiscoveryIntro from "../../discovery-shell/components/DiscoveryIntro";
import MockNotice from "../../discovery-shell/components/MockNotice";
import { useCatalogWorkspace } from "../../discovery-shell/CatalogWorkspace";
import { useDiscovery } from "../hooks/useDiscovery";
import DiscoveryToolbar from "./DiscoveryToolbar";
import DiscoveryFiltersDialog from "./DiscoveryFiltersDialog";
import ProviderCard from "./ProviderCard";
import shell from "../../discovery-shell/shell.module.css";
import styles from "../discovery.module.css";

export default function DiscoveryPage() {
  const state = useDiscovery(); const [filtersOpen, setFiltersOpen] = useState(false); const { persona, pet } = useCatalogWorkspace();
  const { resource } = state;
  return <><DiscoveryHero /><DiscoveryIntro /><section id="results" className={`${shell.container} ${styles.results}`} aria-labelledby="discovery-title">
    <MockNotice />{persona === "customer" && <p className={styles.petNotice}>{pet === "none" ? vi.discovery.search.noPet : formatMessage(vi.discovery.search.viewingPet, { value: pet === "dog" ? "Milo · Chó" : "Miu · Mèo" })}</p>}
    <h2 id="discovery-title">{vi.discovery.search.title}</h2>
    <DiscoveryToolbar query={state.query} searchInput={state.searchInput} onSearch={state.setSearch} onApply={state.apply} onReset={state.reset} onOpenFilters={() => setFiltersOpen(true)} />
    <div role="status" aria-live="polite" className={styles.resultStatus}>{state.searching ? vi.discovery.search.waiting : resource.status === "loading" ? vi.discovery.search.loading : resource.status === "ready" ? formatMessage(vi.discovery.search.results, { total: resource.data.total, page: resource.data.page, pages: resource.data.pages }) : ""}</div>
    <div aria-busy={resource.status === "loading"}>
      {resource.status === "loading" && <div className={styles.grid} aria-hidden="true">{[0, 1, 2, 3].map(i => <div key={i} className={styles.skeleton} />)}</div>}
      {resource.status === "error" && <div className={styles.feedback} role="alert"><p>{resource.error}</p><button type="button" onClick={state.retry}><RefreshCw size={18} aria-hidden="true" />{vi.common.actions.retry}</button></div>}
      {resource.status === "ready" && (resource.data.total ? <>
        <div className={styles.grid}>{resource.data.cards.map(card => <ProviderCard key={card.provider.id} card={card} returnTo={state.returnTo} />)}</div>
        <nav className={styles.pagination} aria-label={vi.discovery.search.pagination}><button type="button" disabled={resource.data.page === 1} onClick={() => state.page(resource.data.page - 1)}><ArrowLeft size={18} aria-hidden="true" />{vi.discovery.search.previous}</button>{Array.from({ length: resource.data.pages }, (_, i) => <button type="button" key={i} aria-current={resource.data.page === i + 1 ? "page" : undefined} aria-label={formatMessage(vi.discovery.search.pageLabel, { page: i + 1 })} onClick={() => state.page(i + 1)}>{i + 1}</button>)}<button type="button" disabled={resource.data.page === resource.data.pages} onClick={() => state.page(resource.data.page + 1)}>{vi.discovery.search.next}<ArrowRight size={18} aria-hidden="true" /></button></nav>
      </> : <div className={styles.feedback}><SearchX size={36} aria-hidden="true" /><h3>{vi.discovery.search.emptyTitle}</h3><p>{vi.discovery.search.emptyDescription}</p><button type="button" onClick={state.reset}>{vi.discovery.search.reset}</button></div>)}
    </div>
    {filtersOpen && <DiscoveryFiltersDialog query={state.query} onApply={state.applyQuery} onReset={state.reset} onClose={() => setFiltersOpen(false)} />}
  </section></>;
}
