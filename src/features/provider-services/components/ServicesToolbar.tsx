import { vi } from "@/lib/locale";
import { useId } from "react";
import { Search } from "lucide-react";
import type { ServiceFilters } from "../types";
import styles from "../services.module.css";

export default function ServicesToolbar({ filters, onChange }: { filters: ServiceFilters; onChange: (filters: ServiceFilters) => void }) {
  const searchId = useId();
  return <div className={styles.toolbar}>
    <div className={styles.filters} role="group" aria-label={vi.provider.services.toolbar.filterLabel}>
      {([["all", vi.common.actions.all], ["visible", vi.provider.services.status.displayed], ["hidden", vi.provider.services.status.hidden]] as const).map(([value, label]) =>
        <button type="button" key={value} aria-pressed={filters.status === value} onClick={() => onChange({ ...filters, status: value })}>{label}</button>)}
    </div>
    <label className={styles.search} htmlFor={searchId}>
      <span className={styles.srOnly}>{vi.provider.services.toolbar.search}</span>
      <Search aria-hidden="true" focusable="false" size={12} strokeWidth={2} className={styles.searchIcon} />
      <input id={searchId} type="search" placeholder={vi.provider.services.toolbar.search} value={filters.query} onChange={(event) => onChange({ ...filters, query: event.target.value })} />
    </label>
  </div>;
}
