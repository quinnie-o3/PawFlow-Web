"use client";

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
    <MockNotice />{persona === "customer" && <p className={styles.petNotice}>{pet === "none" ? "Chưa có hồ sơ thú cưng mẫu · Bạn vẫn có thể khám phá cơ sở." : `Đang xem cho ${pet === "dog" ? "Milo · Chó" : "Miu · Mèo"} · Hồ sơ mô phỏng`}</p>}
    <h2 id="discovery-title">Khám phá dịch vụ</h2>
    <DiscoveryToolbar query={state.query} searchInput={state.searchInput} onSearch={state.setSearch} onApply={state.apply} onReset={state.reset} onOpenFilters={() => setFiltersOpen(true)} />
    <div role="status" aria-live="polite" className={styles.resultStatus}>{state.searching ? "Đang chờ áp dụng từ khóa…" : resource.status === "loading" ? "Đang tìm cơ sở…" : resource.status === "ready" ? `${resource.data.total} cơ sở phù hợp · Trang ${resource.data.page}/${resource.data.pages}` : ""}</div>
    <div aria-busy={resource.status === "loading"}>
      {resource.status === "loading" && <div className={styles.grid} aria-hidden="true">{[0, 1, 2, 3].map(i => <div key={i} className={styles.skeleton} />)}</div>}
      {resource.status === "error" && <div className={styles.feedback} role="alert"><p>{resource.error}</p><button type="button" onClick={state.retry}><RefreshCw size={18} aria-hidden="true" />Thử lại</button></div>}
      {resource.status === "ready" && (resource.data.total ? <>
        <div className={styles.grid}>{resource.data.cards.map(card => <ProviderCard key={card.provider.id} card={card} returnTo={state.returnTo} />)}</div>
        <nav className={styles.pagination} aria-label="Phân trang cơ sở"><button type="button" disabled={resource.data.page === 1} onClick={() => state.page(resource.data.page - 1)}><ArrowLeft size={18} aria-hidden="true" />Trước</button>{Array.from({ length: resource.data.pages }, (_, i) => <button type="button" key={i} aria-current={resource.data.page === i + 1 ? "page" : undefined} aria-label={`Trang ${i + 1}`} onClick={() => state.page(i + 1)}>{i + 1}</button>)}<button type="button" disabled={resource.data.page === resource.data.pages} onClick={() => state.page(resource.data.page + 1)}>Sau<ArrowRight size={18} aria-hidden="true" /></button></nav>
      </> : <div className={styles.feedback}><SearchX size={36} aria-hidden="true" /><h3>Chưa tìm thấy cơ sở phù hợp</h3><p>Thử từ khóa khác hoặc đặt lại bộ lọc.</p><button type="button" onClick={state.reset}>Đặt lại tìm kiếm</button></div>)}
    </div>
    {filtersOpen && <DiscoveryFiltersDialog query={state.query} onApply={state.applyQuery} onReset={state.reset} onClose={() => setFiltersOpen(false)} />}
  </section></>;
}
